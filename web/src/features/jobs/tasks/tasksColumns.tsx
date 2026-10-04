/**
 * Columns of the Tasks table — mockup §3.7: Kind · task (indent 18 px per level + chevron for
 * children; mono kind over "#48811"), Target (ellipsis + title tooltip), Status (pill h22 over
 * "attempt n / m"), Worker (mono), Started · duration, Last error (red when dead), actions
 * `[Details]` ghost xs and `[↺ Retry]` tonal xs on dead rows. The column array is a constant.
 */
import type { ColumnDef } from "@tanstack/react-table";
import { taskTarget, taskWorker, type TaskNode } from "./taskTree";
import { ActionsCell, KindCell, LastErrorCell, StartedCell, StatusCell } from "./tasksCells";

export const TASK_COLUMNS: ColumnDef<TaskNode, unknown>[] = [
  {
    id: "kind",
    header: "Kind · task",
    meta: { hideable: false, minWidth: 200, cellClassName: "whitespace-nowrap" },
    cell: ({ row }) => <KindCell node={row.original} />,
  },
  {
    id: "target",
    header: "Target",
    meta: { minWidth: 150, maxWidth: 170, cellClassName: "text-ink-2" },
    cell: ({ row }) => {
      const target = taskTarget(row.original.task);
      return (
        <span className="block truncate" title={target}>
          {target}
        </span>
      );
    },
  },
  {
    id: "status",
    header: "Status",
    meta: { minWidth: 130 },
    cell: ({ row }) => <StatusCell task={row.original.task} />,
  },
  {
    id: "worker",
    header: "Worker",
    meta: { width: 110, mono: true, cellClassName: "text-ink-2" },
    cell: ({ row }) => taskWorker(row.original.task) ?? <span className="text-muted">—</span>,
  },
  {
    id: "started",
    header: "Started · duration",
    meta: { align: "right", minWidth: 130 },
    cell: ({ row }) => <StartedCell task={row.original.task} />,
  },
  {
    id: "last_error",
    header: "Last error",
    meta: { minWidth: 160, maxWidth: 180 },
    cell: ({ row }) => <LastErrorCell task={row.original.task} />,
  },
  {
    id: "actions",
    header: "Actions",
    meta: { actions: true, align: "right", hideable: false, interactive: true },
    cell: ({ row }) => <ActionsCell task={row.original.task} />,
  },
];
