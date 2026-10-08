import type { components } from "../pipeline.gen";
/** `platform.v_worker_status` rows of `GET /v1/workers`. */

export type WorkerRole =
  "api" | "maintenance" | "finder" | "sections" | "discovery" | "analysis" | string;

export type Worker = components["schemas"]["WorkerRow"];

export interface WorkerListFilters {
  role?: WorkerRole;
}
