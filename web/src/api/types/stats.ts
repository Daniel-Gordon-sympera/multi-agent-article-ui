import type { components } from "../pipeline.gen";
/** `GET /v1/stats/daily` rows and `GET /readyz`. */

export type DailyStats = components["schemas"]["DailyStatsRow"];

export interface DailyStatsFilters {
  created_after?: string;
}

export type ReadinessStatus = "ready" | "not_ready";

export type PipelineReadiness = components["schemas"]["ReadinessStatus"];

/** `GET /v1/exports/{id}`. */
export type ExportRecord = components["schemas"]["ExportRecord"];

export type CreateExportInput = components["schemas"]["CreateExport"];

export type CreatedExport = components["schemas"]["CreatedExport"];

export type ApiKey = components["schemas"]["ApiKeyRecord"];

export type CreatedApiKey = components["schemas"]["CreatedApiKey"];
