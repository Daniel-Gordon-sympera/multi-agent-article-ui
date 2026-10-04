/**
 * `/app/overview`, `/app/overview/active-runs`, `/app/attention` (contract §4.3) and the
 * `/app/estimate` + `/app/jobs/:id/retry-dead` stubs. `/app/signals` is answered here only when
 * no earlier handler (B3's) did — with the mockup's recent-signals order and `limit` semantics.
 */
import { http, HttpResponse } from "msw";
import type {
  ActiveRun,
  AttentionItem,
  OverviewCost,
  OverviewDeadTasks,
  OverviewSignals,
  OverviewSummary,
} from "@/api/types/bff";
import type { JobDetail } from "@/api/types/jobs";
import type { DailyStats } from "@/api/types/stats";
import { db } from "@/mocks/db";
import { dateDaysAgo } from "@/mocks/fixtures/clock";
import { buildRecentSignalRows } from "@/mocks/fixtures/overview";
import { liveWorkerRow } from "@/mocks/fixtures/workers";
import { guard } from "@/mocks/lib/session";

const TERMINAL = new Set(["completed", "partial", "failed", "cancelled"]);
const SITE_RUN_DONE = new Set(["finished", "no_sections", "partial", "failed", "cancelled"]);
const TILE_STATUSES = [
  "queued",
  "finding",
  "exploring",
  "discovering",
  "analysing",
  "finalizing",
] as const;

function nonTerminalJobs(): JobDetail[] {
  return [...db.jobs]
    .filter((job) => !TERMINAL.has(job.status))
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

function rowsByDay(): Map<string, DailyStats> {
  return new Map(db.dailyStats.map((row) => [row.day, row]));
}

function windowSum(byDay: Map<string, DailyStats>, back: number, pick: (r: DailyStats) => number) {
  let total = 0;
  for (let offset = back; offset < back + 7; offset += 1) {
    const row = byDay.get(dateDaysAgo(offset));
    if (row) total += pick(row);
  }
  return total;
}

function series(byDay: Map<string, DailyStats>, pick: (r: DailyStats) => number): number[] {
  const out: number[] = [];
  for (let offset = 13; offset >= 0; offset -= 1) {
    const row = byDay.get(dateDaysAgo(offset));
    out.push(row ? pick(row) : 0);
  }
  return out;
}

function signalsSummary(byDay: Map<string, DailyStats>): OverviewSignals {
  const count = windowSum(byDay, 0, (r) => r.signals);
  const previous = windowSum(byDay, 7, (r) => r.signals);
  return {
    count,
    delta_pct: previous > 0 ? Math.round(((count - previous) / previous) * 100) : null,
    series: series(byDay, (r) => r.signals),
  };
}

function costSummary(byDay: Map<string, DailyStats>): OverviewCost {
  const today = byDay.get(dateDaysAgo(0));
  const yesterday = byDay.get(dateDaysAgo(1));
  const usd = today ? today.cost_usd : 0;
  const yesterdayUsd = yesterday ? yesterday.cost_usd : 0;
  return {
    usd,
    delta_usd:
      usd === null || yesterdayUsd === null ? null : Number((usd - yesterdayUsd).toFixed(4)),
    series: series(byDay, (r) => r.cost_usd ?? r.known_cost_usd),
    cost_complete: today ? today.cost_complete : true,
  };
}

const failuresTotal = (row: DailyStats | undefined) =>
  row ? Object.values(row.failures).reduce((sum, n) => sum + n, 0) : 0;

function deadTasksSummary(byDay: Map<string, DailyStats>): OverviewDeadTasks {
  let count = 0;
  for (let offset = 0; offset < 7; offset += 1)
    count += failuresTotal(byDay.get(dateDaysAgo(offset)));
  return {
    count,
    new_since_yesterday: failuresTotal(byDay.get(dateDaysAgo(0))),
    basis: "daily_stats",
  };
}

export function buildOverviewSummary(): OverviewSummary {
  const running = nonTerminalJobs();
  const runningIds = new Set(running.map((job) => job.id));
  const scouts = db.scouts.filter((scout) =>
    scout.last_run?.jobs.some((job) => runningIds.has(job.job_id)),
  ).length;
  const byStatus = Object.fromEntries(TILE_STATUSES.map((s) => [s, 0])) as Record<
    (typeof TILE_STATUSES)[number],
    number
  >;
  for (const job of running) {
    if (job.status in byStatus) byStatus[job.status as (typeof TILE_STATUSES)[number]] += 1;
  }
  const byDay = rowsByDay();
  return {
    running_jobs: { total: running.length, by_status: byStatus, scouts },
    signals_7d: signalsSummary(byDay),
    cost_today: costSummary(byDay),
    dead_tasks: deadTasksSummary(byDay),
    generated_at: new Date().toISOString(),
  };
}

export function buildActiveRuns(): ActiveRun[] {
  return nonTerminalJobs()
    .slice(0, 25)
    .map((job) => {
      const { costs, ...record } = job;
      const complete = costs.every((c) => c.cost_usd !== null);
      const cost = costs.reduce((sum, c) => sum + (c.cost_usd ?? c.known_cost_usd), 0);
      const siteRuns = db.siteRuns.filter((run) => run.job_id === job.id);
      const total = Math.max(job.progress.seeds, siteRuns.length);
      return {
        ...record,
        cost_usd: complete && costs.length ? Number(cost.toFixed(4)) : costs.length ? null : 0,
        cost_complete: complete,
        sites: total
          ? {
              done: siteRuns.length
                ? siteRuns.filter((run) => SITE_RUN_DONE.has(run.status)).length
                : null,
              total,
            }
          : null,
      };
    });
}

function jobLabel(job: JobDetail): string {
  const county = /county$/i.test(job.county) ? job.county : `${job.county} County`;
  const industry = job.input.industry;
  const target =
    typeof industry === "string"
      ? industry
      : job.kind === "seeds"
        ? `${job.input.seeds?.length ?? 0} seeds`
        : job.kind;
  return `${county}, ${job.state_code} · ${target}`;
}

export function buildAttentionItems(now = new Date()): AttentionItem[] {
  const items: AttentionItem[] = [];
  const weekAgo = new Date(now.getTime() - 7 * 86_400_000).toISOString();
  const deadByJob = new Map<string, typeof db.tasks>();
  for (const task of db.tasks.filter((t) => t.status === "dead" && t.job_id)) {
    const list = deadByJob.get(task.job_id!) ?? [];
    list.push(task);
    deadByJob.set(task.job_id!, list);
  }
  for (const [jobId, tasks] of deadByJob) {
    const job = db.jobs.find((j) => j.id === jobId);
    const kinds = [...new Set(tasks.map((t) => t.kind))];
    const categories = [...new Set(tasks.map((t) => t.error_category).filter(Boolean))];
    const noun = tasks.length === 1 ? "dead task" : "dead tasks";
    items.push({
      kind: "dead_task",
      severity: "fail",
      title:
        kinds.length === 1 ? `${tasks.length} ${noun} · ${kinds[0]}` : `${tasks.length} ${noun}`,
      detail: `${categories.join(", ") || "error"} · ${job ? jobLabel(job) : jobId.slice(0, 8)}`,
      href: `/jobs/${jobId}/tasks`,
      job_id: jobId,
      ...(tasks.length === 1 ? { task_id: tasks[0]!.id } : {}),
    });
  }
  for (const job of db.jobs.filter((j) => j.status === "failed" && j.created_at >= weekAgo)) {
    items.push({
      kind: "failed_job",
      severity: "fail",
      title: "Run failed",
      detail: `${jobLabel(job)} · ${job.stop_reason ?? "no stop reason"}`,
      href: `/jobs/${job.id}`,
      job_id: job.id,
    });
  }
  for (const job of db.jobs.filter((j) => j.status === "partial" && j.created_at >= weekAgo)) {
    items.push({
      kind: "partial_job",
      severity: "warn",
      title: "Partial run waiting for a decision",
      detail: `${jobLabel(job)} · stopped on ${job.stop_reason ?? "unknown"} · resume?`,
      href: `/jobs/${job.id}`,
      job_id: job.id,
    });
  }
  for (const worker of db.workers.map((w) => liveWorkerRow(w, now))) {
    const age = worker.heartbeat_age_seconds;
    if (worker.gone_at || age <= 30) continue;
    const missing = age > 90;
    items.push({
      kind: "slow_worker",
      severity: missing ? "fail" : "warn",
      title: `${worker.instance_id} heartbeat is ${missing ? "missing" : "slow"}`,
      detail: `last seen ${age} s ago · ${worker.role}`,
      href: `/settings/workers#${worker.instance_id}`,
      instance_id: worker.instance_id,
    });
  }
  return items.sort((a, b) => Number(a.severity === "warn") - Number(b.severity === "warn"));
}

export const overviewHandlers = [
  http.get("/app/overview", ({ request }) => {
    const { error } = guard(request);
    if (error) return error;
    return HttpResponse.json(buildOverviewSummary());
  }),

  http.get("/app/overview/active-runs", ({ request }) => {
    const { error } = guard(request);
    if (error) return error;
    return HttpResponse.json({ items: buildActiveRuns(), generated_at: new Date().toISOString() });
  }),

  http.get("/app/attention", ({ request }) => {
    const { error } = guard(request);
    if (error) return error;
    return HttpResponse.json({ items: buildAttentionItems() });
  }),

  /** Fallback only: B3's handler in `signals.ts` is registered earlier and wins. */
  http.get("/app/signals", ({ request }) => {
    const { error } = guard(request);
    if (error) return error;
    const limit = Math.min(200, Number(new URL(request.url).searchParams.get("limit") ?? 50) || 50);
    const rows = buildRecentSignalRows(db);
    return HttpResponse.json({
      items: rows.slice(0, limit),
      next_cursor: null,
      degraded: true,
      scanned_jobs: Math.min(20, db.jobs.length),
      truncated: rows.length > limit,
    });
  }),

  http.get("/app/estimate", ({ request }) => {
    const { error } = guard(request);
    if (error) return error;
    return HttpResponse.json({
      median_cost_usd: 2.95,
      p90_cost_usd: 3.4,
      samples: 10,
      basis: "recent_jobs",
    });
  }),

  http.post("/app/jobs/:jobId/retry-dead", ({ request, params }) => {
    const { error } = guard(request, { minRole: "operator" });
    if (error) return error;
    const dead = db.tasks.filter((t) => t.job_id === params.jobId && t.status === "dead");
    for (const task of dead) {
      task.status = "queued";
      task.attempts = 0;
      task.last_error = null;
      task.error_category = null;
    }
    const job = db.jobs.find((j) => j.id === params.jobId);
    if (job) {
      job.progress.tasks_pending += dead.length;
      job.progress.tasks_dead = 0;
    }
    return HttpResponse.json({ retried: dead.length, task_ids: dead.map((t) => t.id) });
  }),
];
