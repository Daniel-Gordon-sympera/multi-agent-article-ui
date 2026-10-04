/**
 * Operations endpoints of the jobs area: task retry, site-run exploration and work items.
 * Split from `jobs.ts` to keep every handler module under the 400-line limit.
 */
import { http, HttpResponse } from "msw";
import type { WorkItem } from "@/api/types/siteRuns";
import { db } from "@/mocks/db";
import { addSeconds } from "@/mocks/fixtures/clock";
import { PROMPT_VERSION } from "@/mocks/fixtures/jobs";
import { applyExactFilters, paginate, rejectUnknownFilters } from "@/mocks/lib/paging";
import { notFound, problem } from "@/mocks/lib/problem";
import { guard } from "@/mocks/lib/session";

/** Re-queues one dead task and updates the job counters (mockup §3.7 note banner). */
export function requeueDeadTask(taskId: number | string): boolean {
  const task = db.tasks.find((t) => String(t.id) === String(taskId));
  if (!task || task.status !== "dead") return false;
  task.status = "queued";
  task.attempts = 0;
  task.last_error = null;
  task.error_category = null;
  task.run_after = new Date().toISOString();
  task.started_at = null;
  task.finished_at = null;
  task.claimed_by = null;
  const job = db.jobs.find((j) => j.id === task.job_id);
  if (job) {
    job.progress.tasks_dead = Math.max(0, job.progress.tasks_dead - 1);
    job.progress.tasks_pending += 1;
    if (job.status === "partial") {
      job.status = "analysing";
      job.stop_reason = null;
      job.finished_at = null;
    }
  }
  return true;
}

const WORK_OUTCOMES = ["completed", "completed", "rejected", "completed", "failed"] as const;

function workItemsFor(run: (typeof db.siteRuns)[number]): WorkItem[] {
  const started = run.started_at ?? new Date().toISOString();
  const count = Math.min(24, (run.stats.pages ?? 0) + 4);
  return Array.from({ length: count }, (_, i) => {
    const stage = i % 6 === 0 ? "listing" : i % 11 === 0 ? "supplement" : "candidate";
    const outcome = i === 0 ? "completed" : WORK_OUTCOMES[i % WORK_OUTCOMES.length]!;
    return {
      site_run_id: run.id,
      work_key: `w-${run.id.slice(-4)}-${i}`,
      stage,
      candidate: {
        url: `${run.seed_url}/${stage === "listing" ? "business" : "story"}/${i + 1}`,
        title: stage === "listing" ? "Business section listing" : `Candidate article ${i + 1}`,
      },
      outcome,
      error_category: outcome === "failed" ? "network_error" : "",
      attempts: outcome === "failed" ? 3 : 1,
      discovery_sequence: i + 1,
      result:
        outcome === "completed"
          ? { rows: { pages: 1, links: 12 + i, articles: i % 3 === 0 ? 1 : 0 } }
          : outcome === "rejected"
            ? { reason: "not_an_article" }
            : null,
      snapshot_id: outcome === "completed" ? 600_000 + i : null,
      created_at: addSeconds(started, i * 30),
      updated_at: addSeconds(started, i * 30 + 10),
    };
  });
}

export const jobOpsHandlers = [
  http.post("/v1/tasks/:taskId/retry", ({ request, params }) => {
    const { error } = guard(request, { minRole: "operator" });
    if (error) return error;
    const task = db.tasks.find((t) => String(t.id) === String(params.taskId));
    if (!task) return notFound("Task");
    if (task.status !== "dead")
      return problem(409, "task_not_dead", "Only dead tasks can be retried");
    requeueDeadTask(task.id);
    return HttpResponse.json({ task_id: task.id, status: "queued", attempts: 0 }, { status: 202 });
  }),

  http.get("/v1/site-runs/:siteRunId/exploration", ({ request, params }) => {
    const { error } = guard(request);
    if (error) return error;
    const run = db.siteRuns.find((r) => r.id === params.siteRunId);
    if (!run) return notFound("Site run");
    const noSections = run.status === "no_sections";
    return HttpResponse.json({
      site_run_id: run.id,
      domain: run.domain,
      seed_url: run.seed_url,
      origin: run.rank === 1 ? "memory" : "agent",
      memory_source: run.rank === 1 ? "5e1a2b3c-0000-4b00-9000-000000000099" : null,
      model: run.rank === 1 ? null : "deepseek-v4-pro",
      prompt_version: PROMPT_VERSION,
      started_at: run.started_at,
      finished_at: run.started_at ? addSeconds(run.started_at, noSections ? 185 : 240) : null,
      outcome: noSections ? "no_sections" : "completed",
      steps: noSections ? 9 : 14,
      input_tokens: noSections ? 18_000 : 31_000,
      output_tokens: noSections ? 1_100 : 2_400,
      kept: run.stats.sections ?? 0,
      skipped: noSections ? 13 : 4,
      transcript_sha: run.rank === 1 ? null : `tr-${run.id.slice(-4)}`,
      error: null,
    });
  }),

  http.get("/v1/site-runs/:siteRunId/work", ({ request, params }) => {
    const { error } = guard(request);
    if (error) return error;
    const run = db.siteRuns.find((r) => r.id === params.siteRunId);
    if (!run) return notFound("Site run");
    const url = new URL(request.url);
    const rejected = rejectUnknownFilters(url, ["stage", "outcome", "created_after"]);
    if (rejected) return rejected;
    const rows = applyExactFilters(workItemsFor(run), url, ["stage", "outcome"]);
    return HttpResponse.json(paginate(rows, url, (r) => r.work_key));
  }),
];
