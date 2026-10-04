/** Job rows of `GET /v1/jobs*` — platform.jobs + v_job_progress + v_job_costs (contract §1). */
import type { IsoDateTime, JsonObject, Uuid } from "./common";

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

export interface SeedInput {
  title: string;
  url: string;
}

/** `{url}` | `{seeds:[{title,url}]}` | `{location, industry}` depending on `kind`. */
export interface JobInput {
  url?: string;
  seeds?: SeedInput[];
  location?: string;
  industry?: string;
  [extra: string]: unknown;
}

/** The run_config.json keys saved with the job; the API fills defaults. */
export interface JobSettings {
  days?: number;
  sites?: number;
  site_timeout?: number | null;
  max_runtime?: number | null;
  memory_mode?: MemoryMode;
  reanalyze?: boolean;
  reenrich?: boolean;
  [extra: string]: unknown;
}

export interface JobSession {
  started_at: IsoDateTime;
  ended_at?: IsoDateTime | null;
}

/** `platform.jobs.summary`: the run_summary.json written by finalize_job. */
export interface StoredJobSummary {
  job_id: Uuid | null;
  prompt_version: string | null;
  status: JobStatus | null;
  seeds: number | null;
  sources: number | null;
  site_ranking: number | null;
  chosen_seeds: number | null;
  sections: number | null;
  pages: number | null;
  links: number | null;
  articles: number | null;
  summaries: number | null;
  companies: number | null;
  signals: number | null;
  company_flags: number | null;
  started_at: IsoDateTime | null;
  finished_at: IsoDateTime | null;
  duration_seconds: number | null;
  cumulative_duration_seconds: number | null;
  session_count: number | null;
  sessions: JobSession[] | null;
  stop_reason: string | null;
  stop_reasons: string[] | null;
  stopped_early: boolean | null;
  stopped_reason: string | null;
  failures: JsonObject[] | null;
  input_tokens: number | null;
  output_tokens: number | null;
  total_tokens: number | null;
  cumulative_total_tokens: number | null;
  all_services_input_tokens: number | null;
  all_services_output_tokens: number | null;
  all_services_total_tokens: number | null;
  usage_by_stage: Record<string, JsonObject> | null;
  usage_basis: string | null;
  cost_usd: number | null;
  known_cost_usd: number | null;
  unpriced_calls: number | null;
  cost_complete: boolean | null;
  [extra: string]: unknown;
}

export interface JobRecord {
  id: Uuid;
  kind: JobKind;
  input: JobInput;
  county: string;
  state_code: string;
  settings: JobSettings;
  prompt_version: string;
  status: JobStatus;
  stop_reason: string | null;
  client_reference: string | null;
  created_by: string;
  created_at: IsoDateTime;
  started_at: IsoDateTime | null;
  deadline_at: IsoDateTime | null;
  finished_at: IsoDateTime | null;
  summary: StoredJobSummary | null;
  sessions: JobSession[];
}

/** `platform.v_job_progress` row. */
export interface JobProgress {
  job_id: Uuid;
  seeds: number;
  sections: number;
  pages: number;
  links: number;
  articles: number;
  summaries: number;
  companies: number;
  signals: number;
  tasks_pending: number;
  tasks_running: number;
  tasks_dead: number;
}

/** `platform.v_job_costs` row (one per model-call stage). */
export interface JobCost {
  job_id: Uuid;
  stage: string;
  calls: number;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  /** Complete cost; null when any call lacks usage or pricing. */
  cost_usd: number | null;
  known_cost_usd: number;
  unpriced_calls: number;
  unknown_usage_calls: number;
}

export interface JobDetail extends JobRecord {
  progress: JobProgress;
  costs: JobCost[];
}

/** `202` body of `GET /v1/jobs/{id}/summary` while the job runs. */
export interface LiveJobSummary {
  job_id: Uuid;
  status: JobStatus;
  stop_reason: string | null;
  progress: JobProgress;
  costs: JobCost[];
  duration_seconds: number;
  cumulative_duration_seconds: number;
  session_count: number;
  sessions: JobSession[];
}

export type JobSummaryResponse =
  { kind: "live"; summary: LiveJobSummary } | { kind: "stored"; summary: StoredJobSummary };

export interface CreateJobInput {
  kind: JobKind;
  url?: string;
  seeds?: SeedInput[];
  location?: string;
  industry?: string;
  county: string;
  state: string;
  settings?: JobSettings;
  client_reference?: string;
}

export interface CreatedJob {
  job_id: Uuid;
  status: "queued";
  prompt_version: string;
  links: Record<string, string>;
}

export interface JobCommandResult {
  job_id: Uuid;
  status: JobStatus;
}

export interface ResumeJobInput {
  site_timeout?: number | null;
  reanalyze?: boolean;
  reenrich?: boolean;
  memory_mode?: MemoryMode | null;
  refetch_dead_articles?: boolean;
}

export interface ResumedJob {
  job_id: Uuid;
  status: JobStatus;
  task_ids: number[];
}

/** Exact-match filters of `GET /v1/jobs` (industry/client_reference_prefix need B3). */
export interface JobListFilters {
  status?: JobStatus | string;
  county?: string;
  state?: string;
  created_after?: string;
  created_before?: string;
  industry?: string;
  client_reference_prefix?: string;
}
