/**
 * B4 shapes: `GET /app/overview*` (the dashboard tiles and active runs) and the Settings
 * reads `GET /app/system/{queue,dead-by-category,maintenance}`. Re-exported from `./bff`.
 */
import type { IsoDateTime } from "./common";
import type { JobProgress, JobRecord } from "./jobs";

/** `GET /app/system/queue`: global task counts (B3) or the recent jobs' progress counters. */
export interface QueueSummary {
  queued: number;
  running: number;
  /** Unknown (`null`) in the `recent_jobs` basis: v_job_progress has no failed counter. */
  failed: number | null;
  dead: number;
  basis: "api" | "recent_jobs";
  jobs_scanned: number;
}

export interface DeadByCategoryItem {
  category: string;
  count: number;
  /** Share of the largest category, 0–100 (the bar length). */
  pct: number;
}

/** `GET /app/system/dead-by-category?days=`. */
export interface DeadByCategory {
  days: number;
  since: string;
  total: number;
  items: DeadByCategoryItem[];
}

export interface MaintenanceJob {
  name: string;
  cadence: string;
  description: string;
  last_result: null;
}

/** `GET /app/system/maintenance`: the plan's static schedule; results are not exposed. */
export interface MaintenanceSchedule {
  items: MaintenanceJob[];
  note: string;
}

export interface OverviewRunningJobs {
  total: number;
  by_status: Record<
    "queued" | "finding" | "exploring" | "discovering" | "analysing" | "finalizing",
    number
  >;
  /** Distinct Scouts behind the running jobs (ui.batch_jobs). */
  scouts: number;
}

export interface OverviewSignals {
  count: number;
  delta_pct: number | null;
  /** 14 daily values, oldest first. */
  series: number[];
}

export interface OverviewCost {
  /** Today's cost; `null` when a call lacks pricing (`cost_complete` false). */
  usd: number | null;
  delta_usd: number | null;
  series: number[];
  cost_complete: boolean;
}

export interface OverviewDeadTasks {
  count: number;
  new_since_yesterday: number | null;
  basis: "api" | "daily_stats";
}

/** `GET /app/overview` — the four tiles of mockup §3.1. */
export interface OverviewSummary {
  running_jobs: OverviewRunningJobs;
  signals_7d: OverviewSignals;
  cost_today: OverviewCost;
  dead_tasks: OverviewDeadTasks;
  generated_at?: IsoDateTime;
}

/** `GET /app/overview/active-runs` rows: the job record plus live progress and cost. */
export interface ActiveRun extends JobRecord {
  progress: JobProgress | null;
  cost_usd: number | null;
  cost_complete: boolean;
  sites: { done: number | null; total: number | null } | null;
}
