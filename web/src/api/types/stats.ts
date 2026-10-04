/** `GET /v1/stats/daily` rows and `GET /readyz`. */
import type { IsoDate } from "./common";

export interface DailyStats {
  day: IsoDate;
  jobs: number;
  site_runs: number;
  articles: number;
  companies: number;
  signals: number;
  input_tokens: number;
  output_tokens: number;
  cost_usd: number | null;
  known_cost_usd: number;
  unpriced_calls: number;
  unknown_usage_calls: number;
  cost_complete: boolean;
  failures: Record<string, number>;
}

export interface DailyStatsFilters {
  created_after?: string;
}

export type ReadinessStatus = "ready" | "not_ready";

export interface PipelineReadiness {
  status: ReadinessStatus;
  checks: Record<string, string | boolean>;
  version?: string;
}

/** `GET /v1/exports/{id}`. */
export interface ExportRecord {
  id: string;
  job_id: string | null;
  kind: "csv" | "parquet";
  scope: "job" | "dataset";
  tables: string[];
  filters: Record<string, unknown>;
  artifact_sha: string | null;
  status: string;
  created_at: string;
  finished_at: string | null;
  download_url?: string | null;
  download_expired?: boolean;
}

export interface CreateExportInput {
  scope: "job" | "dataset";
  job_id?: string;
  tables: string[];
  kind?: "csv";
  filters?: Record<string, unknown>;
}

export interface CreatedExport {
  export_id: string;
  status: string;
  links: Record<string, string>;
}

export interface ApiKey {
  id: number;
  name: string;
  role: "operator" | "reader";
  created_at: string;
  revoked_at?: string | null;
}

export interface CreatedApiKey extends ApiKey {
  /** Shown exactly once. */
  key: string;
}
