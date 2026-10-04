/**
 * Job › Events — the pipeline event log (`/events`, oldest first as the API pages it): ts,
 * service, stage, event, status, duration, url and an attrs expander; stage / event / status
 * filters. The API has no newest-first order, so the footer says "oldest first".
 */
import type { ColumnDef } from "@tanstack/react-table";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { listJobEvents } from "@/api/pipeline";
import type { PipelineEvent } from "@/api/types/events";
import { Button } from "@/components/Button";
import {
  ColumnChooser,
  DataTable,
  DensityToggle,
  useDataTableControls,
} from "@/components/DataTable";
import { FilterBar } from "@/components/FilterBar";
import { FilterSelect, toOptions } from "@/components/FilterSelect";
import { RelativeTime } from "@/components/RelativeTime";
import { StatusPill } from "@/components/StatusPill";
import { Tag } from "@/components/Tag";
import type { TabProps } from "@/features/jobs/shared/tabProps";
import { optionsFromRows } from "@/features/jobs/shared/tableSearch";
import type { EventsTabSearch } from "@/features/jobs/tabSearchSchemas";
import { useJobResourcePage } from "@/features/jobs/useJobResourcePage";
import { useJobDetail } from "@/features/jobs/useJobQueries";
import { formatDurationPrecise } from "@/lib/format";
import type { StatusDescriptor } from "@/lib/status";

function eventStatus(status: string | null): StatusDescriptor {
  const s = (status ?? "").toLowerCase();
  if (["ok", "succeeded", "finished", "completed", "accepted"].includes(s))
    return { tone: "done", label: s, indicator: "dot" };
  if (["failed", "dead", "error"].includes(s)) return { tone: "fail", label: s, indicator: "dot" };
  if (["running", "started", "claimed"].includes(s))
    return { tone: "running", label: s, indicator: "dot" };
  if (["partial", "retry", "slow"].includes(s)) return { tone: "warn", label: s, indicator: "dot" };
  return { tone: "neutral", label: s || "—", indicator: "none" };
}

function AttrsCell({ event }: { event: PipelineEvent }) {
  const [open, setOpen] = useState(false);
  const keys = Object.keys(event.attrs ?? {});
  if (keys.length === 0 && !event.error_category) return <span className="text-muted">—</span>;
  return (
    <div className="flex flex-col items-start gap-1">
      <Button
        variant="ghost"
        size="xs"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={`${open ? "Hide" : "Show"} attributes of event ${event.id}`}
      >
        {open ? <ChevronDown aria-hidden /> : <ChevronRight aria-hidden />}
        {keys.length} attrs{event.error_category ? ` · ${event.error_category}` : ""}
      </Button>
      {open ? (
        <pre className="max-w-[360px] rounded-control border border-border bg-surface-2 p-2 font-mono text-[11px] leading-relaxed whitespace-pre-wrap text-ink-2">
          {JSON.stringify(
            event.error_category
              ? { error_category: event.error_category, ...event.attrs }
              : event.attrs,
            null,
            2,
          )}
        </pre>
      ) : null}
    </div>
  );
}

const columns: ColumnDef<PipelineEvent, unknown>[] = [
  {
    id: "ts",
    header: "Time",
    meta: { hideable: false, width: 110 },
    cell: ({ row }) => <RelativeTime value={row.original.ts} mode="clock" />,
  },
  {
    id: "service",
    header: "Service",
    meta: { width: 110 },
    cell: ({ row }) => <Tag mono>{row.original.service}</Tag>,
  },
  {
    id: "stage",
    header: "Stage",
    meta: { width: 120, mono: true, cellClassName: "text-ink-2" },
    cell: ({ row }) => row.original.stage ?? "—",
  },
  {
    id: "event",
    header: "Event",
    meta: { minWidth: 150, mono: true },
    cell: ({ row }) => row.original.event,
  },
  {
    id: "status",
    header: "Status",
    meta: { width: 110 },
    cell: ({ row }) => <StatusPill descriptor={eventStatus(row.original.status)} size="sm" />,
  },
  {
    id: "duration",
    header: "Duration",
    meta: { align: "right", width: 100 },
    cell: ({ row }) =>
      row.original.duration_ms === null
        ? "—"
        : formatDurationPrecise(row.original.duration_ms / 1000),
  },
  {
    id: "url",
    header: "URL",
    meta: { minWidth: 180, maxWidth: 260 },
    cell: ({ row }) =>
      row.original.url ? (
        <a
          href={row.original.url}
          target="_blank"
          rel="noopener noreferrer"
          className="block truncate text-[12px] text-brand-600 hover:underline"
          title={row.original.url}
        >
          {row.original.url.replace(/^https?:\/\//, "")}
        </a>
      ) : (
        <span className="text-muted">—</span>
      ),
  },
  {
    id: "task",
    header: "Task",
    meta: { width: 90, mono: true, defaultHidden: true },
    cell: ({ row }) => (row.original.task_id ? `#${row.original.task_id}` : "—"),
  },
  {
    id: "attrs",
    header: "Attributes",
    meta: { minWidth: 160, interactive: true },
    cell: ({ row }) => <AttrsCell event={row.original} />,
  },
];

export function EventsTab({ jobId, search, patchFilters, patchTable }: TabProps<EventsTabSearch>) {
  const job = useJobDetail(jobId);
  const onAfterChange = useCallback(
    (after: string | undefined) => patchTable({ after }),
    [patchTable],
  );
  const filters = useMemo(
    () => ({ stage: search.stage, event: search.event, status: search.status }),
    [search.event, search.stage, search.status],
  );
  const page = useJobResourcePage<PipelineEvent, typeof filters>({
    jobId,
    resource: "events",
    filters,
    fetchPage: listJobEvents,
    jobStatus: job.data?.status,
    kind: "operations",
    after: search.after,
    onAfterChange,
    limit: 100,
  });
  const controls = useDataTableControls({
    columns,
    density: search.density,
    cols: search.cols,
    onChange: patchTable,
  });

  return (
    <div className="flex flex-col gap-4">
      <FilterBar
        tools={
          <>
            <DensityToggle {...controls.densityToggleProps} />
            <ColumnChooser {...controls.columnChooserProps} />
          </>
        }
      >
        <FilterSelect
          label="Stage"
          value={search.stage}
          onValueChange={(stage) => patchFilters({ stage })}
          options={toOptions(optionsFromRows(page.items, (row) => row.stage, search.stage))}
          width={130}
        />
        <FilterSelect
          label="Event"
          value={search.event}
          onValueChange={(event) => patchFilters({ event })}
          options={toOptions(optionsFromRows(page.items, (row) => row.event, search.event))}
          width={150}
        />
        <FilterSelect
          label="Status"
          value={search.status}
          onValueChange={(status) => patchFilters({ status })}
          options={toOptions(optionsFromRows(page.items, (row) => row.status, search.status))}
          width={120}
        />
      </FilterBar>
      <DataTable
        ariaLabel="Events of this job"
        columns={columns}
        data={page.items}
        getRowId={(row) => String(row.id)}
        rowHeight={44}
        minWidth={1000}
        {...controls.tableProps}
        isLoading={page.query.isPending}
        error={page.query.isError ? page.query.error : undefined}
        onRetry={() => void page.query.refetch()}
        emptyTitle="No events recorded"
        emptyDescription="Workers write an event for every task claim, fetch and result."
        pagination={{ ...page.footer, noun: "event", note: "oldest first" }}
      />
    </div>
  );
}
