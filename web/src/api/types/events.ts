import type { components } from "../pipeline.gen";
/** `platform.events` rows of `GET /v1/jobs/{id}/events`. */

export type PipelineEvent = components["schemas"]["EventRow"];

export interface EventListFilters {
  stage?: string;
  event?: string;
  status?: string;
  created_after?: string;
}
