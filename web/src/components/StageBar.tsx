/**
 * StageBar — mockup-spec §5: five h6 segments (gap 3, radius 3) for Finding → Finalizing;
 * done = status-done, current = brand-500, pending = border-strong, failed = status-fail
 * (mockup §6.3 recommendation instead of #D03B3B). Width 84 in tables, 140 in the summary strip.
 * Each segment carries a tooltip; the bar is labelled "Stage progress".
 */
import type { JobStatus } from "@/api/types/jobs";
import { SimpleTooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/cn";
import {
  STAGES,
  STAGE_LABELS,
  deriveStageStates,
  type StageProgressHint,
  type StageState,
} from "@/lib/status";

export interface StageBarProps {
  status?: JobStatus | string | null;
  stopReason?: string | null;
  progress?: StageProgressHint | null;
  /** Explicit states override `status`. */
  states?: StageState[];
  width?: number;
  className?: string;
  tooltips?: boolean;
}

const segmentClass: Record<StageState, string> = {
  done: "bg-status-done-fg",
  current: "bg-brand-500",
  pending: "bg-border-strong",
  failed: "bg-status-fail-fg",
};

const stateWord: Record<StageState, string> = {
  done: "done",
  current: "in progress",
  pending: "pending",
  failed: "failed",
};

export function StageBar({
  status,
  stopReason,
  progress,
  states,
  width = 84,
  className,
  tooltips = true,
}: StageBarProps) {
  const resolved = states ?? deriveStageStates(status, { stopReason, progress });
  const summary = STAGES.map(
    (stage, i) => `${STAGE_LABELS[stage]} ${stateWord[resolved[i] ?? "pending"]}`,
  ).join(", ");
  return (
    <div
      role="img"
      aria-label={`Stage progress: ${summary}`}
      className={cn("flex h-1.5 shrink-0 gap-[3px]", className)}
      style={{ width }}
      data-states={resolved.join(" ")}
    >
      {STAGES.map((stage, i) => {
        const state = resolved[i] ?? "pending";
        const segment = (
          <span
            key={stage}
            className={cn("h-full flex-1 rounded-bar", segmentClass[state])}
            data-stage={stage}
            data-state={state}
          />
        );
        return tooltips ? (
          <SimpleTooltip key={stage} content={`${STAGE_LABELS[stage]} · ${stateWord[state]}`}>
            {segment}
          </SimpleTooltip>
        ) : (
          segment
        );
      })}
    </div>
  );
}
