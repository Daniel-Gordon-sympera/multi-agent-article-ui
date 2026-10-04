/**
 * StatusPill — mockup-spec §1.2 / §5. One pill for every entity: the wording and tone come
 * from `lib/status.ts`. Geometry: h24 (md) or h22 (sm), radius 999, 12/600, 6 px dot; the
 * failed job pill swaps the dot for a 12 px triangle. `secondary` renders the mono stop reason
 * under the pill (11 px muted).
 */
import { TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";
import type { JobStatus } from "@/api/types/jobs";
import type { SiteRunStatus } from "@/api/types/siteRuns";
import type { Task } from "@/api/types/tasks";
import type { Worker } from "@/api/types/workers";
import { cn } from "@/lib/cn";
import {
  healthStatus,
  jobStatus,
  siteRunStatus,
  sourceStatus,
  taskStatus,
  workerStatus,
  type StatusDescriptor,
  type StatusTone,
} from "@/lib/status";

export type StatusPillSize = "md" | "sm";

type EntityProps =
  | { entity: "job"; status: JobStatus | string | null | undefined }
  | { entity: "siteRun"; status: SiteRunStatus | string | null | undefined }
  | { entity: "source"; status: string | null | undefined }
  | { entity: "health"; status: string | boolean | null | undefined }
  | { entity: "task"; task: Pick<Task, "status" | "run_after" | "result">; now?: Date }
  | { entity: "worker"; worker: Pick<Worker, "last_seen" | "gone_at">; now?: Date }
  | { descriptor: StatusDescriptor };

export type StatusPillProps = EntityProps & {
  size?: StatusPillSize;
  secondary?: ReactNode;
  className?: string;
  /** Override the label (e.g. "Retry in 42 s" computed elsewhere). */
  label?: string;
};

export const toneClasses: Record<StatusTone, { pill: string; dot: string }> = {
  running: { pill: "bg-status-running-bg text-status-running-fg", dot: "bg-status-running-fg" },
  done: { pill: "bg-status-done-bg text-status-done-fg", dot: "bg-status-done-fg" },
  warn: { pill: "bg-status-warn-bg text-status-warn-fg", dot: "bg-status-warn-fg" },
  fail: { pill: "bg-status-fail-bg text-status-fail-fg", dot: "bg-status-fail-fg" },
  neutral: { pill: "bg-status-neutral-bg text-status-neutral-fg", dot: "bg-status-neutral-fg" },
};

export function resolveDescriptor(props: EntityProps): StatusDescriptor {
  if ("descriptor" in props) return props.descriptor;
  switch (props.entity) {
    case "job":
      return jobStatus(props.status);
    case "siteRun":
      return siteRunStatus(props.status);
    case "source":
      return sourceStatus(props.status);
    case "health":
      return healthStatus(props.status);
    case "task":
      return taskStatus(props.task, props.now);
    case "worker":
      return workerStatus(props.worker, props.now);
  }
}

export function StatusPill(props: StatusPillProps) {
  const { size = "md", secondary, className, label } = props;
  const d = resolveDescriptor(props);
  const text = label ?? d.label;
  const pill = (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-pill px-2.5 text-[12px] leading-none font-semibold whitespace-nowrap",
        size === "md" ? "h-6" : "h-[22px]",
        toneClasses[d.tone].pill,
        !secondary && className,
      )}
      data-tone={d.tone}
    >
      {d.indicator === "triangle" ? (
        <TriangleAlert size={12} strokeWidth={2.25} aria-hidden />
      ) : d.indicator === "dot" ? (
        <span className={cn("size-1.5 rounded-full", toneClasses[d.tone].dot)} aria-hidden />
      ) : null}
      {text}
    </span>
  );
  if (!secondary) return pill;
  return (
    <span className={cn("inline-flex flex-col items-start", className)}>
      {pill}
      <span className="mt-1 font-mono text-[11px] text-muted">{secondary}</span>
    </span>
  );
}
