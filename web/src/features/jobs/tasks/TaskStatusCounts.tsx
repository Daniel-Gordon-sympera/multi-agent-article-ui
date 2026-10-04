/**
 * Status count chips — mockup §3.7: h32 white chips with an 8 px dot, the status word and a
 * bold count (queued · running · succeeded · "failed · retrying" · dead · cancelled). A chip
 * toggles the matching status filter.
 */
import type { TaskStatus } from "@/api/types/tasks";
import { cn } from "@/lib/cn";
import { TASK_STATUS_ORDER } from "./taskTree";

const DOT: Record<TaskStatus, string> = {
  queued: "bg-faint",
  running: "bg-status-running-fg",
  succeeded: "bg-status-done-fg",
  failed: "bg-status-warn-fg",
  dead: "bg-status-fail-fg",
  cancelled: "bg-border-strong",
};

const WORD: Record<TaskStatus, string> = {
  queued: "queued",
  running: "running",
  succeeded: "succeeded",
  failed: "failed · retrying",
  dead: "dead",
  cancelled: "cancelled",
};

export interface TaskStatusCountsProps {
  counts: Record<TaskStatus, number>;
  active: string | undefined;
  onToggle: (status: TaskStatus | undefined) => void;
}

export function TaskStatusCounts({ counts, active, onToggle }: TaskStatusCountsProps) {
  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Task status counts">
      {TASK_STATUS_ORDER.map((status) => {
        const selected = active === status;
        return (
          <button
            key={status}
            type="button"
            aria-pressed={selected}
            onClick={() => onToggle(selected ? undefined : status)}
            className={cn(
              "inline-flex h-8 items-center gap-2 rounded-control border bg-surface px-3 text-[13px] text-ink-2 outline-none",
              "hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
              selected ? "border-brand-400 bg-brand-50 text-brand-700" : "border-border",
            )}
          >
            <span className={cn("size-2 rounded-full", DOT[status])} aria-hidden />
            {WORD[status]}
            <strong className="font-semibold text-ink tabular">{counts[status]}</strong>
          </button>
        );
      })}
    </div>
  );
}
