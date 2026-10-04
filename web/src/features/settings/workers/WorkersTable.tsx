/**
 * Workers table — mockup §3.11: Instance (mono) · Role (tag) · Version · Started · Last heartbeat
 * (amber when slow) · Current tasks · Proxy · Status pill · Logs/Drain (disabled: not available
 * through the API). A `#<instance_id>` hash highlights that row and scrolls to it.
 */
import type { ColumnDef } from "@tanstack/react-table";
import { useEffect, useMemo } from "react";
import type { Worker } from "@/api/types/workers";
import { Button } from "@/components/Button";
import { DataTable } from "@/components/DataTable";
import { RelativeTime } from "@/components/RelativeTime";
import { StatusPill } from "@/components/StatusPill";
import { Tag } from "@/components/Tag";
import { SimpleTooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/cn";
import { useNow } from "@/lib/hooks/useNow";
import { currentTasksLabel, heartbeatCell, proxyLabel, sortWorkers } from "./workersFormat";

const NOT_AVAILABLE = "Not available through the pipeline API";

function buildColumns(now: Date, highlighted: string | null): ColumnDef<Worker, unknown>[] {
  return [
    {
      id: "instance",
      header: "Instance",
      meta: { hideable: false, mono: true, minWidth: 140 },
      cell: ({ row }) => (
        <span
          id={row.original.instance_id}
          className={cn(
            "text-[13px] text-ink",
            highlighted === row.original.instance_id && "font-semibold text-brand-700",
          )}
        >
          {row.original.instance_id}
        </span>
      ),
    },
    {
      id: "role",
      header: "Role",
      cell: ({ row }) => <Tag>{row.original.role}</Tag>,
    },
    {
      id: "version",
      header: "Version",
      meta: { mono: true, cellClassName: "text-ink-2" },
      cell: ({ row }) => row.original.version || "—",
    },
    {
      id: "started",
      header: "Started",
      cell: ({ row }) => <RelativeTime value={row.original.started_at} mode="smart" />,
    },
    {
      id: "heartbeat",
      header: "Last heartbeat",
      cell: ({ row }) => {
        const beat = heartbeatCell(row.original, now);
        return (
          <span
            className={cn(
              "tabular",
              beat.slow ? "font-semibold text-status-warn-fg" : "text-ink-2",
            )}
          >
            {beat.text}
          </span>
        );
      },
    },
    {
      id: "tasks",
      header: "Current tasks",
      meta: { cellClassName: "text-ink-2" },
      cell: ({ row }) => currentTasksLabel(row.original),
    },
    {
      id: "proxy",
      header: "Proxy",
      meta: { cellClassName: "text-ink-2" },
      cell: ({ row }) => proxyLabel(row.original),
    },
    {
      id: "status",
      header: "Status",
      cell: ({ row }) => <StatusPill entity="worker" worker={row.original} now={now} size="sm" />,
    },
    {
      id: "actions",
      header: "Actions",
      meta: { actions: true, align: "right", interactive: true },
      cell: ({ row }) => (
        <span className="inline-flex items-center gap-1.5">
          <UnavailableAction label="Logs" instance={row.original.instance_id} variant="secondary" />
          <UnavailableAction label="Drain" instance={row.original.instance_id} variant="ghost" />
        </span>
      ),
    },
  ];
}

/**
 * Logs / Drain exist in the mockup but the pipeline API has no route for them: the buttons are
 * `aria-disabled` (not `disabled`, so the tooltip can be reached by mouse and keyboard) and inert.
 */
function UnavailableAction({
  label,
  instance,
  variant,
}: {
  label: string;
  instance: string;
  variant: "secondary" | "ghost";
}) {
  return (
    <SimpleTooltip content={NOT_AVAILABLE}>
      <Button
        variant={variant}
        size="xs"
        aria-disabled="true"
        aria-label={`${label} · ${instance} · ${NOT_AVAILABLE}`}
        className="cursor-default border-border text-faint hover:bg-surface hover:text-faint hover:filter-none"
        onClick={(event) => event.preventDefault()}
      >
        {label}
      </Button>
    </SimpleTooltip>
  );
}

export interface WorkersTableProps {
  workers: Worker[] | undefined;
  loading: boolean;
  error: unknown;
  onRetry: () => void;
  /** Instance to highlight (from the URL hash, contract §7). */
  highlighted: string | null;
}

export function WorkersTable({ workers, loading, error, onRetry, highlighted }: WorkersTableProps) {
  const now = useNow(5_000);
  const columns = useMemo(() => buildColumns(now, highlighted), [now, highlighted]);
  const rows = useMemo(() => sortWorkers(workers ?? []), [workers]);

  useEffect(() => {
    if (!highlighted || !workers) return;
    document.getElementById(highlighted)?.scrollIntoView({ block: "center" });
  }, [highlighted, workers]);

  return (
    <DataTable<Worker>
      ariaLabel="Workers"
      columns={columns}
      data={rows}
      getRowId={(worker) => worker.instance_id}
      rowHeight={44}
      minWidth={1000}
      isLoading={loading && !workers}
      error={workers ? undefined : error}
      onRetry={onRetry}
      rowClassName={(worker) =>
        worker.instance_id === highlighted ? "bg-brand-50 hover:bg-brand-50" : undefined
      }
      emptyTitle="No workers registered"
      emptyDescription="Workers appear here once they report a heartbeat to the pipeline."
    />
  );
}
