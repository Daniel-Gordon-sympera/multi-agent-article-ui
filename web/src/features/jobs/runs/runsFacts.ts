/** Per-row facts of the Runs table from a job record and its progress snapshot (mockup §4.1). */
import type { BatchMembership } from "@/api/types/bff";
import type { JobProgressSnapshot } from "@/api/types/jobsProgress";
import type { JobRecord } from "@/api/types/jobs";
import { createColumnContext } from "@/features/jobs/shared/columnContext";
import { formatInteger, secondsBetween } from "@/lib/format";

export interface RunsColumnFacts {
  progress: Record<string, JobProgressSnapshot>;
  batches: Record<string, BatchMembership>;
}

export const RunsColumnContext = createColumnContext<RunsColumnFacts>("Runs");

export type Counter = "articles" | "signals";

/** Counters come from the progress snapshot while running, from the stored summary afterwards. */
export function counterOf(job: JobRecord, snapshot: JobProgressSnapshot | undefined, key: Counter) {
  const live = snapshot?.progress?.[key];
  if (typeof live === "number") return live;
  const stored = job.summary?.[key];
  return typeof stored === "number" ? stored : null;
}

export function costOf(job: JobRecord, snapshot: JobProgressSnapshot | undefined): number | null {
  if (snapshot && snapshot.cost_usd !== null) return snapshot.cost_usd;
  return job.summary?.cost_usd ?? job.summary?.known_cost_usd ?? null;
}

export function durationOf(job: JobRecord, snapshot: JobProgressSnapshot | undefined) {
  if (snapshot?.duration_seconds !== null && snapshot?.duration_seconds !== undefined) {
    return snapshot.duration_seconds;
  }
  if (typeof job.summary?.duration_seconds === "number") return job.summary.duration_seconds;
  if (!job.started_at) return null;
  return secondsBetween(job.started_at, job.finished_at);
}

/** "5 / 5" · "0 / 0" · "—" (queued or unknown). */
export function sitesOf(job: JobRecord, snapshot: JobProgressSnapshot | undefined): string {
  if (job.status === "queued" || !snapshot) return "—";
  return `${snapshot.sites_done} / ${snapshot.sites_total}`;
}

/** Zero reads as "—" in the Runs table (mockup §4.1). */
export function countCell(value: number | null): string {
  return value === null || value === 0 ? "—" : formatInteger(value);
}
