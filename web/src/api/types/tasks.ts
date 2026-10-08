import type { components } from "../pipeline.gen";
/** `platform.tasks` rows of `GET /v1/jobs/{id}/tasks` and `POST /v1/tasks/{id}/retry`. */

/** `failed` = an attempt failed and a retry is pending; `dead` = max attempts reached. */
export type TaskStatus = "queued" | "running" | "succeeded" | "failed" | "dead" | "cancelled";

export type TaskKind =
  | "find_sources"
  | "rank_sites"
  | "explore_site"
  | "discover_site"
  | "analyze_article"
  | "finalize_job"
  | string;

export type Task = components["schemas"]["TaskRow"];

export interface TaskListFilters {
  status?: TaskStatus | string;
  kind?: TaskKind;
  created_after?: string;
}

export type RetriedTask = components["schemas"]["TaskRetryResult"];
