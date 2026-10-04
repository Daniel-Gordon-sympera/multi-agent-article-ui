/** `platform.v_worker_status` rows of `GET /v1/workers`. */
import type { IsoDateTime } from "./common";

export type WorkerRole =
  "api" | "maintenance" | "finder" | "sections" | "discovery" | "analysis" | string;

export interface Worker {
  instance_id: string;
  role: WorkerRole;
  hostname: string;
  version: string;
  started_at: IsoDateTime;
  last_seen: IsoDateTime;
  current_tasks: number[];
  proxy_ok: boolean | null;
  proxy_checked_at: IsoDateTime | null;
  gone_at: IsoDateTime | null;
  live: boolean;
  heartbeat_age_seconds: number;
  running_tasks: number;
}

export interface WorkerListFilters {
  role?: WorkerRole;
}
