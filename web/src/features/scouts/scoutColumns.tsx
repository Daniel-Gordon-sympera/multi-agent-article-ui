/** Column definitions of the Scouts table — exactly mockup §3.3 (8 columns, rows 48). */
import { Link } from "@tanstack/react-router";
import type { ColumnDef } from "@tanstack/react-table";
import type { ScoutWithRuns, Source } from "@/api/types/bff";
import { Tag } from "@/components/Tag";
import { LastRunCell } from "./LastRunCell";
import { ScoutRowActions } from "./ScoutRowActions";
import { editScoutSearch } from "./scoutLinks";
import { scoutLocation, sourcesLabel } from "./scoutPresentation";

export interface ScoutColumnsOptions {
  /** Active sources for the "N seeds from Data Sources" wording; undefined while loading. */
  sources: readonly Source[] | undefined;
  canOperate: boolean;
}

export function scoutColumns({
  sources,
  canOperate,
}: ScoutColumnsOptions): ColumnDef<ScoutWithRuns, unknown>[] {
  const columns: ColumnDef<ScoutWithRuns, unknown>[] = [
    {
      id: "scout",
      header: "Scout",
      meta: { hideable: false, minWidth: 220 },
      cell: ({ row }) => (
        <div className="flex min-w-0 flex-col gap-0.5">
          <Link
            to="/jobs/new"
            search={editScoutSearch(row.original.id)}
            className="truncate font-semibold text-ink no-underline hover:underline"
          >
            {row.original.name}
          </Link>
          <span className="text-[12px] text-muted">{scoutLocation(row.original)}</span>
        </div>
      ),
    },
    {
      id: "industries",
      header: "Industries",
      meta: { minWidth: 280 },
      cell: ({ row }) =>
        row.original.industries.length ? (
          <div className="flex flex-wrap gap-1.5">
            {row.original.industries.map((industry) => (
              <Tag key={industry}>{industry}</Tag>
            ))}
          </div>
        ) : (
          <span className="text-muted">—</span>
        ),
    },
    {
      id: "sources",
      header: "Sources",
      meta: { minWidth: 170, cellClassName: "text-ink-2" },
      cell: ({ row }) => sourcesLabel(row.original, sources),
    },
    {
      id: "schedule",
      header: "Schedule",
      meta: { width: 96 },
      cell: () => "Manual",
    },
    {
      id: "lastRun",
      header: "Last run",
      meta: { minWidth: 140 },
      cell: ({ row }) => <LastRunCell lastRun={row.original.last_run} />,
    },
    {
      id: "runs",
      header: "Runs",
      meta: { align: "right", width: 72 },
      cell: ({ row }) => row.original.runs_count,
    },
    {
      id: "signals",
      header: "Signals (last run)",
      meta: { align: "right", width: 130, label: "Signals (last run)" },
      cell: ({ row }) =>
        row.original.signals_last_run === null ? (
          <span className="text-muted">—</span>
        ) : (
          row.original.signals_last_run
        ),
    },
  ];
  if (canOperate) {
    columns.push({
      id: "actions",
      header: "Actions",
      meta: { actions: true, align: "right", hideable: false, interactive: true, width: 236 },
      cell: ({ row }) => <ScoutRowActions scout={row.original} />,
    });
  }
  return columns;
}
