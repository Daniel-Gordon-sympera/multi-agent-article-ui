/**
 * Task details dialog (`?task=<id>`): the facts of one task (kind, status, attempts, worker,
 * lease, timestamps, dedupe key) and its payload / result / last error as JSON.
 */
import { RotateCcw } from "lucide-react";
import type { Task } from "@/api/types/tasks";
import { Button } from "@/components/Button";
import { KeyValueGrid } from "@/components/KeyValueGrid";
import { RelativeTime } from "@/components/RelativeTime";
import { StatusPill } from "@/components/StatusPill";
import { Tag } from "@/components/Tag";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatDurationPrecise } from "@/lib/format";
import { taskDuration, taskTarget, taskWorker } from "./taskTree";

function JsonBlock({ title, value }: { title: string; value: unknown }) {
  return (
    <section className="flex flex-col gap-1.5">
      <h3 className="text-section-head text-muted">{title}</h3>
      {value === null || value === undefined ? (
        <p className="text-[13px] text-muted">—</p>
      ) : (
        <pre className="max-h-56 overflow-auto rounded-control border border-border bg-surface-2 p-3 font-mono text-[11px] leading-relaxed text-ink-2">
          {typeof value === "string" ? value : JSON.stringify(value, null, 2)}
        </pre>
      )}
    </section>
  );
}

export interface TaskDetailsDialogProps {
  task: Task | null;
  onClose: () => void;
  canOperate: boolean;
  retrying: boolean;
  onRetry: (task: Task) => void;
}

export function TaskDetailsDialog({
  task,
  onClose,
  canOperate,
  retrying,
  onRetry,
}: TaskDetailsDialogProps) {
  const now = new Date();
  return (
    <Dialog open={task !== null} onOpenChange={(open) => (open ? undefined : onClose())}>
      <DialogContent className="max-w-[680px]">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2">
            <span className="font-mono">{task?.kind}</span>
            <Tag mono>#{task?.id}</Tag>
            {task ? <StatusPill entity="task" task={task} size="sm" /> : null}
          </DialogTitle>
          <DialogDescription>{task ? taskTarget(task) : ""}</DialogDescription>
        </DialogHeader>
        {task ? (
          <div className="flex max-h-[70vh] flex-col gap-5 overflow-y-auto pr-1">
            <KeyValueGrid
              columns={3}
              items={[
                { label: "Attempts", value: `${task.attempts} / ${task.max_attempts}` },
                { label: "Worker", value: taskWorker(task) ?? "—", mono: Boolean(task.claimed_by) },
                { label: "Priority", value: String(task.priority) },
                {
                  label: "Created",
                  value: <RelativeTime value={task.created_at} mode="datetime" />,
                },
                {
                  label: "Started",
                  value: <RelativeTime value={task.started_at} mode="datetime" />,
                },
                {
                  label: "Finished",
                  value: <RelativeTime value={task.finished_at} mode="datetime" />,
                },
                {
                  label: "Duration",
                  value: formatDurationPrecise(taskDuration(task, now)),
                },
                {
                  label: "Run after",
                  value: <RelativeTime value={task.run_after} mode="datetime" />,
                },
                {
                  label: "Lease until",
                  value: <RelativeTime value={task.lease_until} mode="datetime" />,
                },
                {
                  label: "Error category",
                  value: task.error_category ?? "—",
                  mono: Boolean(task.error_category),
                },
                {
                  label: "Site run",
                  value: task.site_run_id ?? "—",
                  mono: Boolean(task.site_run_id),
                },
                {
                  label: "Parent task",
                  value: task.parent_task_id ? `#${task.parent_task_id}` : "—",
                  mono: true,
                },
                { label: "Dedupe key", value: task.dedupe_key ?? "—", mono: true, wide: true },
              ]}
            />
            <JsonBlock title="Last error" value={task.last_error} />
            <JsonBlock title="Payload" value={task.payload} />
            <JsonBlock title="Result" value={task.result} />
          </div>
        ) : null}
        <DialogFooter>
          {task && canOperate && task.status === "dead" ? (
            <Button variant="tonal" onClick={() => onRetry(task)} loading={retrying}>
              <RotateCcw aria-hidden />
              Retry
            </Button>
          ) : null}
          <Button variant="primary" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
