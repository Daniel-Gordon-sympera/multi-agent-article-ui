/** `platform.events` rows of `GET /v1/jobs/{id}/events`. */
import type { IsoDateTime, JsonObject, Uuid } from "./common";

export interface PipelineEvent {
  id: number;
  ts: IsoDateTime;
  job_id: Uuid | null;
  site_run_id: Uuid | null;
  task_id: number | null;
  service: string;
  event: string;
  stage: string | null;
  url: string | null;
  status: string | null;
  error_category: string | null;
  duration_ms: number | null;
  attrs: JsonObject;
}

export interface EventListFilters {
  stage?: string;
  event?: string;
  status?: string;
  created_after?: string;
}
