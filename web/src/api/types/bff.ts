/** `/app/*` shapes — engineering contract §4.3, §4.4, §4.6. */
import type { IsoDateTime, Uuid } from "./common";
import type { JobKind, JobSettings, JobStatus, SeedInput } from "./jobs";
import type { CrossJobSignalRow } from "./signals";

export type Role = "admin" | "operator" | "viewer";

export interface User {
  id: Uuid;
  email: string;
  name: string;
  role: Role;
  must_change_password: boolean;
  created_at: IsoDateTime;
  disabled?: boolean;
  disabled_at?: IsoDateTime | null; // set by the BFF; the mock spells it `disabled`
  last_login_at?: IsoDateTime | null;
}

/** Optional pipeline routes (§4.6). Unknown (probe failed) → all false + `probe_error`. */
export interface Capabilities {
  signals_global: boolean;
  tasks_global: boolean;
  retry_dead: boolean;
  api_keys_list: boolean;
  sources_stats: boolean;
  cost_estimate: boolean;
  jobs_industry_filter: boolean;
  jobs_reference_filter: boolean;
  probe_error?: string | null;
}

export type CapabilityName = keyof Omit<Capabilities, "probe_error">;

export interface ApiStatus {
  ready: boolean;
  checked_at: IsoDateTime | null;
}

export interface Me {
  user: User;
  csrf_token: string;
  capabilities: Capabilities;
  api: ApiStatus;
  version: { bff: string; pipeline_api?: string | null };
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface ChangePasswordInput {
  current_password: string;
  new_password: string;
}

export interface CreateUserInput {
  email: string;
  name: string;
  role: Role;
  password: string;
}

export interface UpdateUserInput {
  name?: string;
  role?: Role;
  disabled?: boolean;
}

export interface CapabilitiesResponse {
  capabilities: Capabilities;
  probed_at: IsoDateTime | null;
  pipeline_api_version?: string | null;
}

/* --------------------------------------------------------------- scouts */

export type SourceMode = "finder" | "seeds";

export interface ScoutInput {
  name: string;
  kind: JobKind;
  county: string;
  state_code: string;
  location?: string | null;
  url?: string | null;
  industries: string[];
  source_mode: SourceMode;
  settings: JobSettings;
}

export interface Scout extends ScoutInput {
  id: Uuid;
  created_by: Uuid;
  created_at: IsoDateTime;
  updated_at: IsoDateTime;
  archived_at: IsoDateTime | null;
}

export interface ScoutLastRunJob {
  job_id: Uuid;
  industry: string | null;
  status: JobStatus | null;
  signals: number | null;
}

export interface ScoutLastRun {
  batch_id: Uuid;
  run_number: number;
  created_at: IsoDateTime;
  jobs: ScoutLastRunJob[];
}

export interface ScoutWithRuns extends Scout {
  runs_count: number;
  last_run: ScoutLastRun | null;
  signals_last_run: number | null;
}

export interface RunScoutInput {
  client_reference_suffix?: string;
}

/* -------------------------------------------------------------- batches */

export interface BatchJob {
  position: number;
  industry: string | null;
  job_id: Uuid | null;
  client_reference: string;
  status: JobStatus | null;
  error: string | null;
}

export interface Batch {
  id: Uuid;
  scout_id: Uuid | null;
  scout_name: string | null;
  run_number: number | null;
  created_at: IsoDateTime;
  jobs: BatchJob[];
}

export interface BatchInput {
  kind: JobKind;
  county: string;
  state_code: string;
  location?: string;
  url?: string;
  seeds?: SeedInput[];
  industries: string[];
  settings: JobSettings;
  scout_id?: Uuid;
  save_as_scout?: { name: string };
}

/** `GET /app/batches?job_ids=` → `{batches: {[job_id]: membership}}`. */
export interface BatchMembership {
  batch_id: Uuid;
  position: number;
  size: number;
  scout_id: Uuid | null;
  scout_name: string | null;
  run_number: number | null;
}

export interface BatchLookup {
  batches: Record<string, BatchMembership>;
}

/* -------------------------------------------------------------- sources */

export type SourceOrigin = "manual" | "finder" | "csv";
export type SourceStatus = "active" | "removed";

export interface SourceFinderFacts {
  tier: string | null;
  verdict: string | null;
  reason: string | null;
  judged_at: IsoDateTime | null;
  rank: number | null;
  job_id: Uuid | null;
}

export interface SourcePrecision {
  accepted: number;
  candidates: number;
  ratio: number | null;
  job_id: Uuid | null;
  at: IsoDateTime | null;
}

export interface Source {
  id: Uuid;
  name: string;
  domain: string;
  url: string;
  county: string;
  state_code: string;
  industries: string[];
  origin: SourceOrigin;
  finder: SourceFinderFacts | null;
  status: SourceStatus;
  created_at: IsoDateTime;
  removed_at: IsoDateTime | null;
  /** Needs capability `sources_stats`; else null. */
  precision: SourcePrecision | null;
}

export interface SourceStats {
  active: number;
  promoted: number;
  removed: number;
  counties: number;
  median_precision: number | null;
}

export interface SourcesResponse {
  items: Source[];
  stats: SourceStats;
}

export interface SourceFilters {
  county?: string;
  state?: string;
  industry?: string;
  origin?: SourceOrigin | string;
  status?: SourceStatus | "all" | string;
  q?: string;
}

export interface SourceInput {
  name: string;
  domain?: string;
  url: string;
  county: string;
  state_code: string;
  industries: string[];
}

export interface SourceImportResult {
  imported: number;
  skipped: Array<{ row: number; reason: string }>;
}

export interface Suggestion {
  domain: string;
  name?: string | null;
  url: string;
  tier?: string | null;
  verdict: string;
  reason: string;
  judged_at: IsoDateTime;
  rank?: number | null;
  job_id?: Uuid | null;
  county: string;
  state_code: string;
  industry?: string | null;
  origin: "finder_memory" | "ranking";
}

export interface SuggestionFilters {
  county?: string;
  state?: string;
  industry?: string;
  limit?: number;
}

export interface PromoteSuggestionInput {
  suggestion: Suggestion;
  name?: string;
  industries?: string[];
}

export interface DismissSuggestionInput {
  domain: string;
  county: string;
  state_code: string;
}

/* ---------------------------------------------------------------- views */

export interface View {
  id: Uuid;
  user_id: Uuid;
  name: string;
  route: string;
  search: Record<string, unknown>;
  columns: string[] | null;
  shared: boolean;
  created_at: IsoDateTime;
}

export interface ViewInput {
  name: string;
  route: string;
  search: Record<string, unknown>;
  columns?: string[] | null;
  shared?: boolean;
}

/* ---------------------------------------------------------------- prefs */

export type ThemePreference = "system" | "light" | "dark";
export type DensityPreference = "comfortable" | "compact";
export type TimeDisplayPreference = "utc" | "local";
export type LandingPreference = "/" | "/jobs" | "/signals";

export interface Prefs {
  theme: ThemePreference;
  density: DensityPreference;
  time_display: TimeDisplayPreference;
  landing: LandingPreference;
}

export const DEFAULT_PREFS: Prefs = {
  theme: "system",
  density: "comfortable",
  time_display: "utc",
  landing: "/",
};

/* ------------------------------------------------------------ attention */

export type AttentionKind =
  "dead_task" | "partial_job" | "failed_job" | "slow_worker" | "api_not_ready";

export interface AttentionItem {
  kind: AttentionKind;
  severity: "fail" | "warn";
  title: string;
  detail: string;
  href: string;
  job_id?: Uuid;
  task_id?: number;
  instance_id?: string;
}

/* --------------------------------------------------------------- system */

export interface SystemInfo {
  bff: { version: string; migrations_head: string | null; started_at: IsoDateTime | null };
  pipeline: {
    url_host: string;
    ready: boolean;
    checks: Record<string, string | boolean>;
    version?: string | null;
    prompt_version?: string | null;
  };
  capabilities: Capabilities;
  capabilities_probed_at?: IsoDateTime | null;
  model_prices: null | Array<Record<string, unknown>>;
  notes?: string[]; // what the pipeline API does not expose yet
}

/* -------------------------------------------------------------- signals */

export interface CrossJobSignalFilters {
  signal?: string;
  materiality?: string;
  company_key?: string;
  hq_scope?: string;
  org_kind?: string;
  industry?: string;
  job_industry?: string;
  state?: string;
  county?: string;
  revenue_bin?: string;
  date_after?: string;
  date_before?: string;
  job_id?: string;
  batch_id?: string;
  q?: string;
}

export interface CrossJobSignalsPage {
  items: CrossJobSignalRow[];
  next_cursor: string | null;
  degraded: boolean;
  scanned_jobs?: number;
  truncated?: boolean;
}

export interface RetryDeadResult {
  retried: number;
  task_ids: number[];
}

export type Estimate =
  | { median_cost_usd: number; p90_cost_usd: number; samples: number; basis: "api" | "recent_jobs" }
  | { samples: 0 };

export interface BffReadiness {
  status: "ready" | "not_ready";
  checks: Record<string, string | boolean>;
}

export type { CrossJobSignalRow };
