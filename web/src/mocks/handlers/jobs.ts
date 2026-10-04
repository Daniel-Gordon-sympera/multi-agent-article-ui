/**
 * `/v1/jobs*` — list with exact-match filters and keyset pagination, detail with ETag/304,
 * summary (202 live / 200 stored), the per-job sub-lists, create/cancel/resume, task retry.
 */
import { http, HttpResponse } from "msw";
import type { CreateJobInput, JobDetail, LiveJobSummary, ResumeJobInput } from "@/api/types/jobs";
import { db, nextMockId } from "@/mocks/db";
import { addSeconds } from "@/mocks/fixtures/clock";
import { MAIN_JOB_ID, PROMPT_VERSION } from "@/mocks/fixtures/jobs";
import {
  applyExactFilters,
  etagOf,
  paginate,
  readJson,
  rejectUnknownFilters,
} from "@/mocks/lib/paging";
import { notFound, problem } from "@/mocks/lib/problem";
import { guard } from "@/mocks/lib/session";

export function findJob(id: string | readonly string[] | undefined): JobDetail | undefined {
  const needle = String(id ?? "");
  return (
    db.jobs.find((job) => job.id === needle) ??
    db.jobs.find((job) => needle.length >= 8 && job.id.startsWith(needle))
  );
}

/** Rows that only exist for the main job (the fixtures carry one fully populated run). */
function forJob<T>(jobId: string, rows: T[]): T[] {
  return jobId === MAIN_JOB_ID ? rows : [];
}

const TERMINAL = new Set(["completed", "partial", "failed", "cancelled"]);

function liveSummary(job: JobDetail): LiveJobSummary {
  const started = job.started_at ? new Date(job.started_at).getTime() : Date.now();
  const duration = Math.max(0, (Date.now() - started) / 1000);
  return {
    job_id: job.id,
    status: job.status,
    stop_reason: job.stop_reason,
    progress: job.progress,
    costs: job.costs,
    duration_seconds: duration,
    cumulative_duration_seconds: duration,
    session_count: job.sessions.length || 1,
    sessions: job.sessions,
  };
}

function subList<T extends object>(
  path: string,
  rows: (jobId: string) => T[],
  filters: readonly string[],
  idOf: (row: T) => string | number,
) {
  return http.get(`/v1/jobs/:jobId/${path}`, ({ request, params }) => {
    const { error } = guard(request);
    if (error) return error;
    const job = findJob(params.jobId);
    if (!job) return notFound("Job");
    const url = new URL(request.url);
    const rejected = rejectUnknownFilters(url, filters);
    if (rejected) return rejected;
    const filtered = applyExactFilters(rows(job.id), url, filters);
    return HttpResponse.json(paginate(filtered, url, idOf));
  });
}

export const jobHandlers = [
  http.get("/v1/jobs", ({ request }) => {
    const { error } = guard(request);
    if (error) return error;
    const url = new URL(request.url);
    const rejected = rejectUnknownFilters(url, [
      "status",
      "county",
      "state",
      "created_after",
      "created_before",
    ]);
    if (rejected) return rejected;
    let rows = [...db.jobs].sort((a, b) => b.created_at.localeCompare(a.created_at));
    const status = url.searchParams.get("status");
    if (status) rows = rows.filter((j) => j.status === status);
    const county = url.searchParams.get("county");
    if (county) rows = rows.filter((j) => j.county.toLowerCase() === county.toLowerCase());
    const state = url.searchParams.get("state");
    if (state) rows = rows.filter((j) => j.state_code.toLowerCase() === state.toLowerCase());
    const after = url.searchParams.get("created_after");
    if (after) rows = rows.filter((j) => j.created_at >= after);
    const before = url.searchParams.get("created_before");
    if (before) rows = rows.filter((j) => j.created_at <= before);
    const page = paginate(rows, url, (j) => j.id);
    return HttpResponse.json({
      items: page.items.map(({ progress: _p, costs: _c, ...record }) => record),
      next_cursor: page.next_cursor,
    });
  }),

  http.post("/v1/jobs", async ({ request }) => {
    const { user, error } = guard(request, { minRole: "operator" });
    if (error) return error;
    const body = await readJson<CreateJobInput>(request);
    if (!body?.kind || !body.county || !body.state) {
      return problem(422, "validation_error", "kind, county and state are required");
    }
    if (
      body.client_reference &&
      db.jobs.some((j) => j.client_reference === body.client_reference)
    ) {
      const existing = db.jobs.find((j) => j.client_reference === body.client_reference)!;
      return problem(409, "duplicate_client_reference", "A job with this client_reference exists", {
        job_id: existing.id,
      });
    }
    const id = `0193${nextMockId().padStart(4, "0")}-aaaa-4bbb-8ccc-${Date.now().toString(16).padStart(12, "0").slice(-12)}`;
    const now = new Date().toISOString();
    const job: JobDetail = {
      id,
      kind: body.kind,
      input: { url: body.url, seeds: body.seeds, location: body.location, industry: body.industry },
      county: body.county,
      state_code: body.state.length === 2 ? body.state.toUpperCase() : body.state,
      settings: {
        days: 30,
        sites: 5,
        site_timeout: 0,
        max_runtime: 18000,
        memory_mode: "full",
        reanalyze: false,
        ...body.settings,
      },
      prompt_version: PROMPT_VERSION,
      status: "queued",
      stop_reason: null,
      client_reference: body.client_reference ?? null,
      created_by: user.name,
      created_at: now,
      started_at: null,
      deadline_at: null,
      finished_at: null,
      summary: null,
      sessions: [],
      progress: {
        job_id: id,
        seeds: 0,
        sections: 0,
        pages: 0,
        links: 0,
        articles: 0,
        summaries: 0,
        companies: 0,
        signals: 0,
        tasks_pending: 1,
        tasks_running: 0,
        tasks_dead: 0,
      },
      costs: [],
    };
    db.jobs.unshift(job);
    return HttpResponse.json(
      {
        job_id: id,
        status: "queued",
        prompt_version: PROMPT_VERSION,
        links: { self: `/v1/jobs/${id}`, summary: `/v1/jobs/${id}/summary` },
      },
      { status: 202 },
    );
  }),

  http.get("/v1/jobs/:jobId", ({ request, params }) => {
    const { error } = guard(request);
    if (error) return error;
    const job = findJob(params.jobId);
    if (!job) return notFound("Job");
    const etag = etagOf(job);
    const headers = { ETag: etag, "Cache-Control": "private, no-cache" };
    if (request.headers.get("if-none-match") === etag)
      return new HttpResponse(null, { status: 304, headers });
    return HttpResponse.json(job, { headers });
  }),

  http.get("/v1/jobs/:jobId/summary", ({ request, params }) => {
    const { error } = guard(request);
    if (error) return error;
    const job = findJob(params.jobId);
    if (!job) return notFound("Job");
    const terminal = TERMINAL.has(job.status);
    const body = terminal ? job.summary : liveSummary(job);
    const etag = etagOf(body);
    const headers = { ETag: etag, "Cache-Control": "private, no-cache" };
    if (request.headers.get("if-none-match") === etag)
      return new HttpResponse(null, { status: 304, headers });
    return HttpResponse.json(body, { status: terminal ? 200 : 202, headers });
  }),

  http.post("/v1/jobs/:jobId/cancel", ({ request, params }) => {
    const { error } = guard(request, { minRole: "operator" });
    if (error) return error;
    const job = findJob(params.jobId);
    if (!job) return notFound("Job");
    if (TERMINAL.has(job.status) || job.status === "cancelling") {
      return problem(409, "job_not_cancellable", `A ${job.status} job cannot be cancelled`);
    }
    job.status = "cancelling";
    const target = job;
    setTimeout(() => {
      if (target.status === "cancelling") {
        target.status = "cancelled";
        target.stop_reason = "cancelled_by_operator";
        target.finished_at = new Date().toISOString();
      }
    }, 4000);
    return HttpResponse.json({ job_id: job.id, status: job.status }, { status: 202 });
  }),

  http.post("/v1/jobs/:jobId/resume", async ({ request, params }) => {
    const { error } = guard(request, { minRole: "operator" });
    if (error) return error;
    const job = findJob(params.jobId);
    if (!job) return notFound("Job");
    if (!["partial", "failed", "cancelled"].includes(job.status)) {
      return problem(409, "job_not_resumable", `A ${job.status} job cannot be resumed`);
    }
    const body = (await readJson<ResumeJobInput>(request)) ?? {};
    if (body.site_timeout !== undefined && body.site_timeout !== null)
      job.settings.site_timeout = body.site_timeout;
    if (body.memory_mode) job.settings.memory_mode = body.memory_mode;
    job.status = job.progress.articles > 0 ? "analysing" : "exploring";
    job.stop_reason = null;
    job.finished_at = null;
    const now = new Date().toISOString();
    job.sessions = [...job.sessions, { started_at: now, ended_at: null }];
    job.deadline_at = addSeconds(now, Number(job.settings.max_runtime ?? 18000));
    const taskIds = db.tasks
      .filter((t) => t.job_id === job.id && t.status === "dead")
      .map((t) => t.id);
    return HttpResponse.json(
      { job_id: job.id, status: job.status, task_ids: taskIds },
      { status: 202 },
    );
  }),

  subList(
    "site-runs",
    (id) => forJob(id, db.siteRuns),
    ["status"],
    (r) => r.id,
  ),
  subList(
    "tasks",
    (id) =>
      forJob(id, db.tasks)
        .slice()
        .sort((a, b) => a.id - b.id),
    ["status", "kind", "created_after"],
    (r) => r.id,
  ),
  subList(
    "events",
    (id) => forJob(id, db.results.events),
    ["stage", "event", "status", "created_after"],
    (r) => r.id,
  ),
  subList(
    "summaries",
    (id) => forJob(id, db.results.summaries),
    ["industry", "materiality", "signal", "include"],
    (r) => r.id,
  ),
  subList(
    "articles",
    (id) => forJob(id, db.results.articles),
    ["domain", "origin", "created_after"],
    (r) => r.id,
  ),
  subList(
    "sections",
    (id) => forJob(id, db.results.sections),
    ["kept", "origin"],
    (r) => r.id,
  ),
  subList(
    "sources",
    (id) => forJob(id, db.results.finderSources),
    ["verdict", "origin"],
    (r) => r.domain,
  ),
  subList(
    "ranking",
    (id) => forJob(id, db.results.ranking),
    ["tier", "chosen"],
    (r) => r.url,
  ),

  http.get("/v1/jobs/:jobId/export/:file", ({ request, params }) => {
    const { error } = guard(request);
    if (error) return error;
    const job = findJob(params.jobId);
    if (!job) return notFound("Job");
    const table = String(params.file).replace(/\.csv$/, "");
    const csv = `table,job_id\r\n${table},${job.id}\r\n`;
    return new HttpResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${table}.csv"`,
      },
    });
  }),

  http.post("/v1/tasks/:taskId/retry", ({ request, params }) => {
    const { error } = guard(request, { minRole: "operator" });
    if (error) return error;
    const task = db.tasks.find((t) => String(t.id) === String(params.taskId));
    if (!task) return notFound("Task");
    if (task.status !== "dead")
      return problem(409, "task_not_dead", "Only dead tasks can be retried");
    task.status = "queued";
    task.attempts = 0;
    task.last_error = null;
    task.error_category = null;
    task.run_after = new Date().toISOString();
    const job = db.jobs.find((j) => j.id === task.job_id);
    if (job) {
      job.progress.tasks_dead = Math.max(0, job.progress.tasks_dead - 1);
      job.progress.tasks_pending += 1;
      if (job.status === "partial") job.status = "analysing";
    }
    return HttpResponse.json({ task_id: task.id, status: "queued", attempts: 0 }, { status: 202 });
  }),

  http.get("/v1/site-runs/:siteRunId/exploration", ({ request, params }) => {
    const { error } = guard(request);
    if (error) return error;
    const run = db.siteRuns.find((r) => r.id === params.siteRunId);
    if (!run) return notFound("Site run");
    return HttpResponse.json({
      site_run_id: run.id,
      domain: run.domain,
      seed_url: run.seed_url,
      origin: run.rank === 1 ? "memory" : "agent",
      memory_source: null,
      model: "deepseek-v4-pro",
      prompt_version: PROMPT_VERSION,
      started_at: run.started_at,
      finished_at: run.started_at ? addSeconds(run.started_at, 240) : null,
      outcome: run.status === "no_sections" ? "completed" : "completed",
      steps: 14,
      input_tokens: 31_000,
      output_tokens: 2_400,
      kept: run.stats.sections ?? 0,
      skipped: 4,
      transcript_sha: `tr-${run.id.slice(-4)}`,
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
    const rows = Array.from({ length: Math.min(20, run.stats.pages ?? 0) }, (_, i) => ({
      site_run_id: run.id,
      work_key: `w-${run.id.slice(-4)}-${i}`,
      stage: i % 5 === 0 ? "listing" : "candidate",
      candidate: { url: `${run.seed_url}/page/${i}` },
      outcome: i % 7 === 0 ? "rejected" : "completed",
      error_category: "",
      attempts: 1,
      discovery_sequence: i + 1,
      result: { rows: { pages: 1, links: 12, articles: i % 3 === 0 ? 1 : 0 } },
      snapshot_id: 600_000 + i,
      created_at: addSeconds(run.started_at ?? new Date().toISOString(), i * 30),
      updated_at: addSeconds(run.started_at ?? new Date().toISOString(), i * 30 + 10),
    }));
    return HttpResponse.json(
      paginate(applyExactFilters(rows, url, ["stage", "outcome"]), url, (r) => r.work_key),
    );
  }),
];
