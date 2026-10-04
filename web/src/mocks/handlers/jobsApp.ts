/**
 * `/app` endpoints of the jobs area (contract §4.3 + the progress aggregate): job progress
 * snapshots for the Runs table, retry-all-dead, the cost estimate and a Scout's runs.
 */
import { http, HttpResponse } from "msw";
import type { JobProgressSnapshot, JobsProgressMap } from "@/api/types/jobsProgress";
import type { JobDetail } from "@/api/types/jobs";
import { db } from "@/mocks/db";
import { buildJobSiteCounts, MAIN_JOB_ID } from "@/mocks/fixtures/jobs";
import { problem } from "@/mocks/lib/problem";
import { guard } from "@/mocks/lib/session";
import { requeueDeadTask } from "./jobsOps";

const SITE_RUN_DONE = new Set(["finished", "partial", "failed", "no_sections", "cancelled"]);
const SITE_COUNTS = buildJobSiteCounts();

export function jobCostUsd(job: JobDetail): number | null {
  if (!job.costs.length) return null;
  const total = job.costs.reduce((sum, c) => sum + (c.cost_usd ?? c.known_cost_usd ?? 0), 0);
  return Math.round(total * 100) / 100;
}

function siteCounts(job: JobDetail): { done: number; total: number } {
  if (job.id === MAIN_JOB_ID) {
    const runs = db.siteRuns.filter((r) => r.job_id === job.id);
    return { done: runs.filter((r) => SITE_RUN_DONE.has(r.status)).length, total: runs.length };
  }
  return SITE_COUNTS[job.id] ?? { done: 0, total: job.progress.seeds };
}

function durationSeconds(job: JobDetail): number | null {
  if (!job.started_at) return null;
  const end = job.finished_at ? new Date(job.finished_at).getTime() : Date.now();
  return Math.max(0, Math.round((end - new Date(job.started_at).getTime()) / 1000));
}

export function progressSnapshot(job: JobDetail): JobProgressSnapshot {
  const sites = siteCounts(job);
  return {
    status: job.status,
    progress: job.progress,
    cost_usd: jobCostUsd(job),
    sites_total: sites.total,
    sites_done: sites.done,
    duration_seconds: durationSeconds(job),
  };
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

function percentile90(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.9) - 1)]!;
}

export const jobAppHandlers = [
  http.get("/app/jobs/progress", ({ request }) => {
    const { error } = guard(request);
    if (error) return error;
    const ids = (new URL(request.url).searchParams.get("job_ids") ?? "")
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);
    if (ids.length > 50) return problem(422, "too_many_ids", "At most 50 job ids per call");
    const result: JobsProgressMap = {};
    for (const id of new Set(ids)) {
      const job = db.jobs.find((j) => j.id === id);
      if (job) result[id] = progressSnapshot(job);
    }
    return HttpResponse.json(result);
  }),

  http.post("/app/jobs/:jobId/retry-dead", ({ request, params }) => {
    const { error } = guard(request, { minRole: "operator" });
    if (error) return error;
    const job = db.jobs.find((j) => j.id === params.jobId);
    if (!job) return problem(404, "resource_not_found", "The job does not exist");
    const dead = db.tasks.filter((t) => t.job_id === job.id && t.status === "dead");
    const retried = dead.filter((t) => requeueDeadTask(t.id)).map((t) => t.id);
    return HttpResponse.json({ retried: retried.length, task_ids: retried, skipped_task_ids: [] });
  }),

  http.get("/app/estimate", ({ request }) => {
    const { error } = guard(request);
    if (error) return error;
    const url = new URL(request.url);
    const kind = url.searchParams.get("kind") ?? "location_industry";
    const industry = url.searchParams.get("industry")?.toLowerCase();
    const samples = db.jobs
      .filter((j) => j.status === "completed" && j.kind === kind)
      .filter((j) => !industry || String(j.input.industry ?? "").toLowerCase() === industry)
      .slice(0, 10)
      .map(jobCostUsd)
      .filter((v): v is number => v !== null);
    if (samples.length === 0) return HttpResponse.json({ samples: 0 });
    return HttpResponse.json({
      median_cost_usd: Math.round(median(samples) * 100) / 100,
      p90_cost_usd: Math.round(percentile90(samples) * 100) / 100,
      samples: samples.length,
      basis: "recent_jobs",
    });
  }),

  /** Minimal stand-in for B2's `GET /app/scouts/{id}/jobs`: the jobs of the Scout's runs. */
  http.get("/app/scouts/:scoutId/jobs", ({ request, params }) => {
    const { error } = guard(request);
    if (error) return error;
    const scout = db.scouts.find((s) => s.id === params.scoutId);
    if (!scout) return problem(404, "resource_not_found", "The Scout does not exist");
    const ids = new Set(scout.last_run?.jobs.map((j) => j.job_id) ?? []);
    const items = db.jobs
      .filter((j) => ids.has(j.id))
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .map(({ progress: _p, costs: _c, ...record }) => record);
    return HttpResponse.json({ items, next_cursor: null });
  }),
];
