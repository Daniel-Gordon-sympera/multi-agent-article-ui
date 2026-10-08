import { formatArticleDate } from "@/lib/articleDate";
/**
 * Cell renderers of the signal column registry (mockup §3.6 / §3.8) and `buildSignalColumns`,
 * which turns the registry into TanStack column definitions for one route. The renderers are
 * plain functions (no hooks) so this module exports no components.
 */
import { Link } from "@tanstack/react-router";
import type { ColumnDef } from "@tanstack/react-table";
import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import { Tag } from "@/components/Tag";
import { SignalDetailLink } from "@/features/signals/SignalDetailLink";
import { SignalRecordCell } from "@/features/signals/SignalRecordCell";
import { shortId } from "@/lib/format";
import {
  RECORD_CELL_MAX_WIDTH,
  SIGNAL_COLUMNS,
  type SignalColumnSpec,
  type SignalTableRow,
  type SignalsTableRoute,
} from "./signalColumns";

const dash = <span className="text-faint">—</span>;

function text(value: string | null | undefined): ReactNode {
  return value && value.trim() ? value : dash;
}

/** "Orange, FL" — the job's county and state as the explorer draws them. */
export function jobLocationLabel(row: SignalTableRow): string {
  const county = (row.county ?? "").trim();
  const state = (row.state_code ?? "").trim().toUpperCase();
  if (county && state) return `${county}, ${state}`;
  return county || state || "—";
}

function renderHqCity(row: SignalTableRow, withScope: boolean): ReactNode {
  return (
    <div className="flex flex-col items-start gap-1">
      <span className="whitespace-nowrap">{text(row.scope_place)}</span>
      {withScope && row.hq_scope ? <Tag>{row.hq_scope}</Tag> : null}
    </div>
  );
}

function renderIndustry(row: SignalTableRow): ReactNode {
  return (
    <div className="flex max-w-[130px] min-w-0 flex-col gap-0.5">
      <span className="truncate" title={row.company_industry ?? undefined}>
        {text(row.company_industry)}
      </span>
      {row.company_sub_industry ? (
        <span
          className="truncate text-[11px] text-muted"
          title={row.company_sub_industry ?? undefined}
        >
          {row.company_sub_industry}
        </span>
      ) : null}
    </div>
  );
}

function renderSource(row: SignalTableRow): ReactNode {
  return (
    <div className="flex max-w-[130px] min-w-0 flex-col gap-0.5">
      <a
        href={row.url ?? undefined}
        target="_blank"
        rel="noopener noreferrer"
        className="truncate font-medium text-brand-600 hover:text-brand-700 hover:underline"
        title={row.url ?? undefined}
      >
        {row.source_domain}
      </a>
      <span className="truncate text-[11px] text-muted" title={row.title ?? undefined}>
        {row.title}
      </span>
    </div>
  );
}

function renderJobLocation(row: SignalTableRow): ReactNode {
  const sub = [row.job_industry, row.source_domain].filter(Boolean).join(" · ");
  return (
    <div className="flex max-w-[140px] min-w-0 flex-col gap-0.5">
      <span className="whitespace-nowrap">{jobLocationLabel(row)}</span>
      <span className="truncate text-[11px] text-muted" title={sub}>
        {sub}
      </span>
    </div>
  );
}

function renderJob(row: SignalTableRow): ReactNode {
  if (!row.job_id) return dash;
  return (
    <Link
      to="/jobs/$jobId"
      params={{ jobId: row.job_id }}
      className="text-[12px] font-medium text-brand-600 hover:text-brand-700 hover:underline"
      title={row.job_id ?? undefined}
    >
      {shortId(row.job_id)}
    </Link>
  );
}

function renderOpen(row: SignalTableRow): ReactNode {
  return (
    <SignalDetailLink
      signalId={row.id}
      jobId={row.job_id}
      aria-label="Open signal details"
      className="inline-flex size-8 items-center justify-center rounded-control text-muted hover:bg-surface-2 hover:text-ink"
    >
      <ChevronRight size={18} strokeWidth={2} aria-hidden />
    </SignalDetailLink>
  );
}

function renderCell(spec: SignalColumnSpec, route: SignalsTableRoute, row: SignalTableRow) {
  switch (spec.id) {
    case "record":
      return <SignalRecordCell row={row} maxWidth={RECORD_CELL_MAX_WIDTH[route]} />;
    case "hqCity":
      return renderHqCity(row, route === "job");
    case "hqScope":
      return row.hq_scope ? <Tag>{row.hq_scope}</Tag> : dash;
    case "hqState":
      return text(row.hq_state);
    case "industry":
      return renderIndustry(row);
    case "revenueBin":
      return text(row.revenue_bin);
    case "date":
      return (
        <span className="whitespace-nowrap">{formatArticleDate(row.date, row.date_precision)}</span>
      );
    case "source":
      return renderSource(row);
    case "jobLocation":
      return renderJobLocation(row);
    case "job":
      return renderJob(row);
    case "open":
      return renderOpen(row);
  }
}

/** The registry as column definitions for one route; visibility is decided by the controls. */
export function buildSignalColumns(route: SignalsTableRoute): ColumnDef<SignalTableRow, unknown>[] {
  return SIGNAL_COLUMNS.map((spec) => ({
    id: spec.id,
    header: spec.label[route],
    cell: ({ row }) => renderCell(spec, route, row.original),
    enableHiding: spec.hideable,
    meta: {
      label: spec.label[route],
      hideable: spec.hideable,
      defaultHidden: !spec.defaultOn.includes(route),
      align: spec.align,
      width: spec.width,
      minWidth: spec.minWidth,
      maxWidth: spec.maxWidth,
      actions: spec.id === "open",
    },
  }));
}
