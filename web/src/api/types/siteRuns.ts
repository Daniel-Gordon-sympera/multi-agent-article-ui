/** `platform.site_runs` rows of `GET /v1/jobs/{id}/site-runs`. */
import type { IsoDateTime, Uuid } from "./common";

export type SiteRunStatus =
  | "queued"
  | "exploring"
  | "no_sections"
  | "discovering"
  | "finished"
  | "partial"
  | "failed"
  | "cancelled";

export interface SiteRunStats {
  sections?: number;
  pages?: number;
  links?: number;
  articles?: number;
  fetches?: number;
  bytes?: number;
  tokens?: number;
  candidates?: number;
  accepted?: number;
  [extra: string]: unknown;
}

export interface SiteRun {
  id: Uuid;
  job_id: Uuid;
  seed_url: string;
  domain: string;
  title: string;
  rank: number | null;
  status: SiteRunStatus;
  stop_reason: string | null;
  started_at: IsoDateTime | null;
  finished_at: IsoDateTime | null;
  stats: SiteRunStats;
}

export interface SiteRunListFilters {
  status?: SiteRunStatus | string;
}

/** `sections.explorations` row of `GET /v1/site-runs/{id}/exploration`. */
export interface Exploration {
  site_run_id: Uuid;
  domain: string;
  seed_url: string;
  origin: "agent" | "memory" | string;
  memory_source: Uuid | null;
  model: string | null;
  prompt_version: string | null;
  started_at: IsoDateTime;
  finished_at: IsoDateTime | null;
  outcome: string;
  steps: number;
  input_tokens: number;
  output_tokens: number;
  kept: number;
  skipped: number;
  transcript_sha: string | null;
  error: string | null;
}

/** `discovery.work_items` row of `GET /v1/site-runs/{id}/work`. */
export interface WorkItem {
  site_run_id: Uuid;
  work_key: string;
  stage: "listing" | "candidate" | "supplement" | string;
  candidate: Record<string, unknown>;
  outcome: string;
  error_category: string;
  attempts: number;
  discovery_sequence: number;
  result: Record<string, unknown> | null;
  snapshot_id: number | null;
  created_at: IsoDateTime;
  updated_at: IsoDateTime;
}
