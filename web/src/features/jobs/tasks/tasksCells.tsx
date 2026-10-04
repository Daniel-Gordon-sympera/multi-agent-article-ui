/** Cells of the Tasks table; clock, role and handlers come from `TasksColumnContext`. */
import { ChevronRight, RotateCcw } from "lucide-react";
import type { Task } from "@/api/types/tasks";
import { Button } from "@/components/Button";
import { RelativeTime } from "@/components/RelativeTime";
import { StatusPill } from "@/components/StatusPill";
import { cn } from "@/lib/cn";
import { formatDurationPrecise } from "@/lib/format";
import { TasksColumnContext, taskDuration, type TaskNode } from "./taskTree";

export function KindCell({ node }: { node: TaskNode }) {
  const { task, depth } = node;
  return (
    <div className="flex items-center" style={{ paddingLeft: depth * 18 }}>
      {depth > 0 ? (
        <ChevronRight
          size={12}
          strokeWidth={2}
          className="mr-1.5 shrink-0 text-muted"
          aria-hidden
        />
      ) : null}
      <div className="flex flex-col">
        <span className="font-mono text-[12px] text-ink">{task.kind}</span>
        <span className="font-mono text-[11px] text-muted">#{task.id}</span>
      </div>
    </div>
  );
}

export function StatusCell({ task }: { task: Task }) {
  const { now } = TasksColumnContext.useColumnContext();
  return (
    <div className="flex flex-col items-start gap-1">
      <StatusPill entity="task" task={task} now={now} size="sm" />
      <span className="text-[11px] text-muted">
        attempt {task.attempts} / {task.max_attempts}
      </span>
    </div>
  );
}

export function StartedCell({ task }: { task: Task }) {
  const { now } = TasksColumnContext.useColumnContext();
  const duration = taskDuration(task, now);
  return (
    <div className="flex flex-col items-end gap-0.5">
      <RelativeTime value={task.started_at} mode="clock" fallback="—" />
      <span className="text-[12px] text-muted">
        {duration === null ? "—" : formatDurationPrecise(duration)}
      </span>
    </div>
  );
}

export function LastErrorCell({ task }: { task: Task }) {
  if (!task.last_error) return <span className="text-muted">—</span>;
  return (
    <span
      className={cn(
        "line-clamp-2 text-[12px] leading-[1.3]",
        task.status === "dead" ? "text-status-fail-fg" : "text-ink-2",
      )}
      title={task.last_error}
    >
      {task.last_error}
    </span>
  );
}

export function ActionsCell({ task }: { task: Task }) {
  const { canOperate, retryingId, onDetails, onRetry } = TasksColumnContext.useColumnContext();
  return (
    <div className="flex items-center justify-end gap-1">
      {canOperate && task.status === "dead" ? (
        <Button
          variant="tonal"
          size="xs"
          onClick={() => onRetry(task)}
          loading={retryingId === task.id}
          aria-label={`Retry task ${task.id}`}
        >
          <RotateCcw aria-hidden />
          Retry
        </Button>
      ) : null}
      <Button
        variant="ghost"
        size="xs"
        onClick={() => onDetails(task)}
        aria-label={`Details of task ${task.id}`}
      >
        Details
      </Button>
    </div>
  );
}
