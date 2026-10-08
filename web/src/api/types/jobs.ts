import type { components } from "../pipeline.gen";
/** Job rows of `GET /v1/jobs*` — platform.jobs + v_job_progress + v_job_costs (contract §1). */

export type JobKind = "url" | "seeds" | "location_industry";

export type JobStatus =
  | "queued"
  | "finding"
  | "exploring"
  | "discovering"
  | "analysing"
  | "finalizing"
  | "completed"
  | "partial"
  | "failed"
  | "cancelling"
  | "cancelled";

export type MemoryMode = "full" | "pages_only" | "off";

export type SeedInput = components["schemas"]["SeedInput"];

/** `{url}` | `{seeds:[{title,url}]}` | `{location, industry}` depending on `kind`. */
export interface JobInput {
  url?: string;
  seeds?: SeedInput[];
  location?: string;
  industry?: string;
  [extra: string]: unknown;
}

/** The run_config.json keys saved with the job; the API fills defaults. */
export type JobSettings = Partial<components["schemas"]["JobSettings"]>;

export type JobSession = components["schemas"]["JobSession"];

/** `platform.jobs.summary`: the run_summary.json written by finalize_job. */
export type StoredJobSummary = components["schemas"]["StoredJobSummary"];

export type JobRecord = components["schemas"]["JobRecord"];

/** `platform.v_job_progress` row. */
export type JobProgress = components["schemas"]["JobProgress"];

/** `platform.v_job_costs` row (one per model-call stage). */
export type JobCost = components["schemas"]["JobCost"];

export type JobDetail = components["schemas"]["JobDetail"];

/** `202` body of `GET /v1/jobs/{id}/summary` while the job runs. */
export type LiveJobSummary = components["schemas"]["LiveJobSummary"];

export type JobSummaryResponse =
  { kind: "live"; summary: LiveJobSummary } | { kind: "stored"; summary: StoredJobSummary };

export type CreateJobInput = Omit<components["schemas"]["CreateJob"], "settings"> & {
  settings?: JobSettings;
};

export type CreatedJob = components["schemas"]["CreatedJob"];

export type JobCommandResult = components["schemas"]["JobCommandResult"];

export type ResumeJobInput = Partial<components["schemas"]["ResumeJob"]>;

export type ResumedJob = components["schemas"]["ResumedJob"];

/** Server filters applied before pagination. */
export interface JobListFilters {
  order?: "created_desc" | "id_asc";
  q?: string;
  status_group?: "running";
  kind?: JobKind;
  status?: JobStatus | string;
  county?: string;
  state?: string;
  created_after?: string;
  created_before?: string;
  industry?: string;
  client_reference_prefix?: string;
}
