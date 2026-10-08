import type { components } from "../pipeline.gen";
/** `platform.site_runs` rows of `GET /v1/jobs/{id}/site-runs`. */

export type SiteRunStatus =
  | "queued"
  | "exploring"
  | "no_sections"
  | "discovering"
  | "finished"
  | "partial"
  | "failed"
  | "cancelled";

export type SiteRun = components["schemas"]["SiteRunRow"];

export interface SiteRunListFilters {
  status?: SiteRunStatus | string;
}

/** `sections.explorations` row of `GET /v1/site-runs/{id}/exploration`. */
export type Exploration = components["schemas"]["ExplorationRow"];

/** `discovery.work_items` row of `GET /v1/site-runs/{id}/work`. */
export type WorkItem = components["schemas"]["WorkRow"];
