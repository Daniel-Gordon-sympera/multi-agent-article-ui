/** `platform.tasks` rows of `GET /v1/jobs/{id}/tasks` and `POST /v1/tasks/{id}/retry`. */
import type { IsoDateTime, Uuid } from "./common";

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

export interface Task {
  id: number;
  kind: TaskKind;
  payload: Record<string, unknown>;
  job_id: Uuid | null;
  site_run_id: Uuid | null;
  parent_task_id: number | null;
  dedupe_key: string | null;
  status: TaskStatus;
  priority: number;
  run_after: IsoDateTime;
  attempts: number;
  max_attempts: number;
  lease_until: IsoDateTime | null;
  lease_token?: string | null;
  claimed_by: string | null;
  last_error: string | null;
  error_category: string | null;
  result: Record<string, unknown> | null;
  created_at: IsoDateTime;
  started_at: IsoDateTime | null;
  finished_at: IsoDateTime | null;
}

export interface TaskListFilters {
  status?: TaskStatus | string;
  kind?: TaskKind;
  created_after?: string;
}

export interface RetriedTask {
  task_id: number;
  status: "queued";
  attempts: 0;
}
