/**
 * Columns of the Site runs table — mockup §3.5: Site run (domain link / "rank n · finder"),
 * Status, Sections, Pages, Articles, Fetched, Stop reason (mono), Duration and the xs actions
 * `[Work items]` secondary · `[Exploration]` ghost. The column array is a module constant.
 */
import type { ColumnDef } from "@tanstack/react-table";
import type { SiteRun } from "@/api/types/siteRuns";
import { StatusPill } from "@/components/StatusPill";
import { formatBytes } from "@/lib/format";
import { formatCount } from "./siteRunFacts";
import { ActionsCell, DurationCell, SiteCell } from "./siteRunsCells";

export const SITE_RUN_COLUMNS: ColumnDef<SiteRun, unknown>[] = [
  {
    id: "site",
    header: "Site run",
    meta: { hideable: false, minWidth: 220 },
    cell: ({ row }) => <SiteCell run={row.original} />,
  },
  {
    id: "status",
    header: "Status",
    meta: { minWidth: 120 },
    cell: ({ row }) => <StatusPill entity="siteRun" status={row.original.status} />,
  },
  {
    id: "sections",
    header: "Sections",
    meta: { align: "right", width: 90 },
    cell: ({ row }) => formatCount(row.original.stats.sections),
  },
  {
    id: "pages",
    header: "Pages",
    meta: { align: "right", width: 80 },
    cell: ({ row }) => formatCount(row.original.stats.pages),
  },
  {
    id: "articles",
    header: "Articles",
    meta: { align: "right", width: 90 },
    cell: ({ row }) => formatCount(row.original.stats.articles),
  },
  {
    id: "fetched",
    header: "Fetched",
    meta: { align: "right", width: 90 },
    cell: ({ row }) =>
      typeof row.original.stats.bytes === "number" ? formatBytes(row.original.stats.bytes) : "—",
  },
  {
    id: "stop_reason",
    header: "Stop reason",
    meta: { mono: true, cellClassName: "text-ink-2", minWidth: 150 },
    cell: ({ row }) => row.original.stop_reason ?? <span className="text-muted">—</span>,
  },
  {
    id: "duration",
    header: "Duration",
    meta: { align: "right", width: 90 },
    cell: ({ row }) => <DurationCell run={row.original} />,
  },
  {
    id: "actions",
    header: "Actions",
    meta: { actions: true, align: "right", hideable: false, interactive: true },
    cell: ({ row }) => <ActionsCell run={row.original} />,
  },
];
