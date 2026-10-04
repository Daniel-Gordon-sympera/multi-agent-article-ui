/**
 * Status vocabularies and the colour maps of engineering contract §5.5
 * (mockup-spec §1.2). Every pill in the UI goes through these functions so the
 * wording and tone of a status are decided in exactly one place.
 */
import type { JobStatus } from "@/api/types/jobs";
import type { SiteRunStatus } from "@/api/types/siteRuns";
import type { Task, TaskStatus } from "@/api/types/tasks";
import type { Worker } from "@/api/types/workers";
import { formatCountdown } from "@/lib/format";

export type StatusTone = "running" | "done" | "warn" | "fail" | "neutral";

/** How a pill signals its tone beside the colour (status is never colour-only). */
export type StatusIndicator = "dot" | "triangle" | "none";

export interface StatusDescriptor {
  tone: StatusTone;
  label: string;
  indicator: StatusIndicator;
}

const descriptor = (
  tone: StatusTone,
  label: string,
  indicator: StatusIndicator = "dot",
): StatusDescriptor => ({ tone, label, indicator });

export const JOB_STATUSES: readonly JobStatus[] = [
  "queued",
  "finding",
  "exploring",
  "discovering",
  "analysing",
  "finalizing",
  "completed",
  "partial",
  "failed",
  "cancelling",
  "cancelled",
];

export const RUNNING_JOB_STATUSES: readonly JobStatus[] = [
  "finding",
  "exploring",
  "discovering",
  "analysing",
  "finalizing",
];

export const TERMINAL_JOB_STATUSES: readonly JobStatus[] = [
  "completed",
  "partial",
  "failed",
  "cancelled",
];

export function isTerminalJobStatus(status: JobStatus | string | null | undefined): boolean {
  return (TERMINAL_JOB_STATUSES as readonly string[]).includes(status ?? "");
}

export function isRunningJobStatus(status: JobStatus | string | null | undefined): boolean {
  return (RUNNING_JOB_STATUSES as readonly string[]).includes(status ?? "");
}

/** Jobs that accept `POST /cancel`: queued, running stages. */
export function isCancellableJobStatus(status: JobStatus | string | null | undefined): boolean {
  return status === "queued" || isRunningJobStatus(status);
}

/** Jobs that accept `POST /resume`: partial, failed and cancelled runs. */
export function isResumableJobStatus(status: JobStatus | string | null | undefined): boolean {
  return status === "partial" || status === "failed" || status === "cancelled";
}

const capitalise = (word: string): string =>
  word.length ? word.charAt(0).toUpperCase() + word.slice(1) : word;

const JOB_STATUS_MAP: Record<JobStatus, StatusDescriptor> = {
  queued: descriptor("neutral", "Queued"),
  finding: descriptor("running", "Finding"),
  exploring: descriptor("running", "Exploring"),
  discovering: descriptor("running", "Discovering"),
  analysing: descriptor("running", "Analysing"),
  finalizing: descriptor("running", "Finalizing"),
  completed: descriptor("done", "Completed"),
  partial: descriptor("warn", "Partial"),
  failed: descriptor("fail", "Failed", "triangle"),
  cancelling: descriptor("neutral", "Cancelling"),
  cancelled: descriptor("neutral", "Cancelled"),
};

export function jobStatus(status: JobStatus | string | null | undefined): StatusDescriptor {
  return (
    JOB_STATUS_MAP[status as JobStatus] ??
    descriptor("neutral", capitalise(String(status ?? "unknown")))
  );
}

const SITE_RUN_STATUS_MAP: Record<SiteRunStatus, StatusDescriptor> = {
  queued: descriptor("neutral", "Queued"),
  exploring: descriptor("running", "Exploring"),
  no_sections: descriptor("neutral", "No sections"),
  discovering: descriptor("running", "Discovering"),
  finished: descriptor("done", "Finished"),
  partial: descriptor("warn", "Partial"),
  failed: descriptor("fail", "Failed"),
  cancelled: descriptor("neutral", "Cancelled"),
};

export function siteRunStatus(status: SiteRunStatus | string | null | undefined): StatusDescriptor {
  return (
    SITE_RUN_STATUS_MAP[status as SiteRunStatus] ??
    descriptor("neutral", capitalise(String(status ?? "unknown").replace(/_/g, " ")))
  );
}

export const TASK_STATUSES: readonly TaskStatus[] = [
  "queued",
  "running",
  "succeeded",
  "failed",
  "dead",
  "cancelled",
];

function taskWasRejected(task: Pick<Task, "result">): boolean {
  const result = task.result;
  if (!result || typeof result !== "object") return false;
  const record = result as Record<string, unknown>;
  return record.rejected === true || record.outcome === "rejected" || record.status === "rejected";
}

function taskWasPartial(task: Pick<Task, "result">): boolean {
  const result = task.result;
  if (!result || typeof result !== "object") return false;
  const record = result as Record<string, unknown>;
  return record.partial === true || record.outcome === "partial" || record.status === "partial";
}

/**
 * Task pill: `failed` reads "Retry in 42 s" (from `run_after`), a succeeded task whose
 * result says `rejected` reads "Rejected", `partial` results read "Partial".
 */
export function taskStatus(
  task: Pick<Task, "status" | "run_after" | "result">,
  now: Date = new Date(),
): StatusDescriptor {
  switch (task.status) {
    case "succeeded":
      if (taskWasRejected(task)) return descriptor("neutral", "Rejected");
      if (taskWasPartial(task)) return descriptor("warn", "Partial");
      return descriptor("done", "Succeeded");
    case "running":
      return descriptor("running", "Running");
    case "failed": {
      const countdown = formatCountdown(task.run_after, { now });
      return descriptor("warn", countdown === "now" ? "Retrying" : `Retry ${countdown}`);
    }
    case "dead":
      return descriptor("fail", "Dead");
    case "queued":
      return descriptor("neutral", "Queued");
    case "cancelled":
      return descriptor("neutral", "Cancelled");
    default:
      return descriptor("neutral", capitalise(String(task.status)));
  }
}

/** Heartbeat thresholds (contract §5.5): ≤ 30 s healthy, ≤ 90 s slow, else missing. */
export const WORKER_HEALTHY_SECONDS = 30;
export const WORKER_SLOW_SECONDS = 90;

export function workerHeartbeatAge(
  worker: Pick<Worker, "last_seen">,
  now: Date = new Date(),
): number {
  const seen = new Date(worker.last_seen).getTime();
  if (Number.isNaN(seen)) return Number.POSITIVE_INFINITY;
  return Math.max(0, (now.getTime() - seen) / 1000);
}

export function workerStatus(
  worker: Pick<Worker, "last_seen" | "gone_at">,
  now: Date = new Date(),
): StatusDescriptor {
  if (worker.gone_at) return descriptor("fail", "Gone");
  const age = workerHeartbeatAge(worker, now);
  if (age <= WORKER_HEALTHY_SECONDS) return descriptor("done", "Healthy");
  if (age <= WORKER_SLOW_SECONDS) return descriptor("warn", "Slow heartbeat");
  return descriptor("fail", "Missing");
}

export type SourceStatus = "active" | "removed";

export function sourceStatus(status: SourceStatus | string | null | undefined): StatusDescriptor {
  if (status === "active") return descriptor("done", "Active");
  if (status === "removed") return descriptor("neutral", "Removed");
  return descriptor("neutral", capitalise(String(status ?? "unknown")));
}

/** Readiness and check values: "ready"/"ok" → done, "not_ready"/"error" → fail, else warn. */
export function healthStatus(value: string | boolean | null | undefined): StatusDescriptor {
  if (value === true || value === "ready" || value === "ok" || value === "healthy") {
    return descriptor(
      "done",
      value === "ready" ? "Ready" : value === true ? "Ready" : capitalise(value),
    );
  }
  if (value === false || value === "not_ready" || value === "error" || value === "down") {
    return descriptor(
      "fail",
      value === false ? "Not ready" : capitalise(String(value).replace(/_/g, " ")),
    );
  }
  if (value === null || value === undefined) return descriptor("neutral", "Unknown");
  return descriptor("warn", capitalise(String(value).replace(/_/g, " ")));
}

export type Materiality = "High" | "Medium" | "Low";

export function normaliseMateriality(value: string | null | undefined): Materiality | null {
  const v = (value ?? "").trim().toLowerCase();
  if (v === "high") return "High";
  if (v === "medium") return "Medium";
  if (v === "low") return "Low";
  return null;
}

/* ------------------------------------------------------------------ stages */

export const STAGES = ["finding", "exploring", "discovering", "analysing", "finalizing"] as const;
export type Stage = (typeof STAGES)[number];
export const STAGE_LABELS: Record<Stage, string> = {
  finding: "Finding",
  exploring: "Exploring",
  discovering: "Discovering",
  analysing: "Analysing",
  finalizing: "Finalizing",
};

export type StageState = "done" | "current" | "pending" | "failed";

/** Stop reasons that pin the failing stage when a job ends as `failed`. */
const FAILED_STAGE_BY_REASON: Record<string, Stage> = {
  no_sources_found: "finding",
  finder_failed: "finding",
  no_sources: "finding",
  no_sections: "exploring",
  no_sections_kept: "exploring",
  exploration_failed: "exploring",
  no_articles: "discovering",
  discovery_failed: "discovering",
  analysis_failed: "analysing",
  finalize_failed: "finalizing",
};

export interface StageProgressHint {
  seeds?: number;
  sections?: number;
  articles?: number;
  summaries?: number;
}

function furthestStageFromProgress(progress: StageProgressHint | null | undefined): number {
  if (!progress) return 0;
  if ((progress.summaries ?? 0) > 0) return 3;
  if ((progress.articles ?? 0) > 0) return 2;
  if ((progress.sections ?? 0) > 0 || (progress.seeds ?? 0) > 0) return 1;
  return 0;
}

/**
 * The five StageBar/Stepper states for a job status. Running statuses mark earlier stages
 * done and the named stage current; `failed` colours the failing stage (from `stop_reason`
 * or the progress counters) and leaves the rest pending; terminal successes are all done.
 */
export function deriveStageStates(
  status: JobStatus | string | null | undefined,
  hint: { stopReason?: string | null; progress?: StageProgressHint | null } = {},
): StageState[] {
  const index = STAGES.indexOf(status as Stage);
  if (index >= 0) {
    return STAGES.map((_, i) => (i < index ? "done" : i === index ? "current" : "pending"));
  }
  switch (status) {
    case "completed":
    case "partial":
      return STAGES.map(() => "done");
    case "failed": {
      const byReason = hint.stopReason ? FAILED_STAGE_BY_REASON[hint.stopReason] : undefined;
      const failedAt = byReason
        ? STAGES.indexOf(byReason)
        : furthestStageFromProgress(hint.progress);
      return STAGES.map((_, i) => (i < failedAt ? "done" : i === failedAt ? "failed" : "pending"));
    }
    case "cancelling":
    case "cancelled": {
      const reached = furthestStageFromProgress(hint.progress);
      return STAGES.map((_, i) => (i < reached ? "done" : "pending"));
    }
    default:
      return STAGES.map(() => "pending");
  }
}
