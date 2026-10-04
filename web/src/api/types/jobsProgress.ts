/**
 * `GET /app/jobs/progress?job_ids=a,b,c` → one snapshot per job id (the list endpoint returns
 * `JobRecord` without progress or costs). Ids the API does not know are omitted.
 */
import type { JobProgress, JobStatus } from "./jobs";

export interface JobProgressSnapshot {
  status: JobStatus;
  progress: JobProgress | null;
  /** Sum of the known cost over every stage; null when the job has no ledger rows yet. */
  cost_usd: number | null;
  sites_total: number;
  sites_done: number;
  duration_seconds: number | null;
}

export type JobsProgressMap = Record<string, JobProgressSnapshot>;
