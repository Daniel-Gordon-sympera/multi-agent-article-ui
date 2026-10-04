/**
 * Daily table of `GET /v1/stats/daily` (newest first): day, jobs, site runs, articles,
 * companies, signals, tokens in/out, cost (with an "incomplete" marker when a call lacked
 * pricing) and a failures-by-category disclosure.
 */
import type { ColumnDef } from "@tanstack/react-table";
import { useMemo, type ReactNode } from "react";
import type { DailyStats } from "@/api/types/stats";
import { DataTable } from "@/components/DataTable";
import { Tag } from "@/components/Tag";
import { formatCompactNumber, formatDate, formatInteger, formatMoney } from "@/lib/format";
import { dayCost, failuresCount } from "./statsFormat";

const numeric = (
  header: string,
  pick: (r: DailyStats) => number,
): ColumnDef<DailyStats, unknown> => ({
  id: header.toLowerCase().replace(/\s+/g, "_"),
  header,
  meta: { align: "right" },
  cell: ({ row }) => formatInteger(pick(row.original)),
});

function FailuresCell({ row }: { row: DailyStats }) {
  const count = failuresCount(row);
  if (count === 0) return <span className="text-muted">—</span>;
  const entries = Object.entries(row.failures).sort(
    (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
  );
  return (
    <details className="group">
      <summary className="cursor-pointer list-none text-[13px] font-medium text-brand-600 hover:underline">
        {count} {count === 1 ? "failure" : "failures"}
        <span className="sr-only"> by category</span>
      </summary>
      <ul className="mt-1.5 flex flex-col gap-0.5">
        {entries.map(([category, n]) => (
          <li
            key={category}
            className="flex items-center justify-between gap-3 font-mono text-[12px]"
          >
            <span className="text-ink-2">{category}</span>
            <span className="tabular">{n}</span>
          </li>
        ))}
      </ul>
    </details>
  );
}

const columns: ColumnDef<DailyStats, unknown>[] = [
  {
    id: "day",
    header: "Day",
    meta: { hideable: false },
    cell: ({ row }) => <span className="font-medium text-ink">{formatDate(row.original.day)}</span>,
  },
  numeric("Jobs", (r) => r.jobs),
  numeric("Site runs", (r) => r.site_runs),
  numeric("Articles", (r) => r.articles),
  numeric("Companies", (r) => r.companies),
  numeric("Signals", (r) => r.signals),
  {
    id: "tokens_in",
    header: "Tokens in",
    meta: { align: "right" },
    cell: ({ row }) => formatCompactNumber(row.original.input_tokens),
  },
  {
    id: "tokens_out",
    header: "Tokens out",
    meta: { align: "right" },
    cell: ({ row }) => formatCompactNumber(row.original.output_tokens),
  },
  {
    id: "cost",
    header: "Cost",
    meta: { align: "right" },
    cell: ({ row }) => (
      <span className="inline-flex items-center justify-end gap-1.5">
        {formatMoney(dayCost(row.original))}
        {row.original.cost_complete ? null : (
          <Tag tone="white" title={`${row.original.unpriced_calls} calls without a price`}>
            incomplete
          </Tag>
        )}
      </span>
    ),
  },
  {
    id: "failures",
    header: "Failures",
    meta: { interactive: true, minWidth: 180 },
    cell: ({ row }) => <FailuresCell row={row.original} />,
  },
];

export interface DailyStatsTableProps {
  rows: DailyStats[];
  loading: boolean;
  error: unknown;
  onRetry: () => void;
  footer?: ReactNode;
}

export function DailyStatsTable({ rows, loading, error, onRetry, footer }: DailyStatsTableProps) {
  const data = useMemo(() => [...rows].sort((a, b) => b.day.localeCompare(a.day)), [rows]);
  return (
    <DataTable<DailyStats>
      ariaLabel="Daily stats"
      columns={columns}
      data={data}
      getRowId={(row) => row.day}
      rowHeight={44}
      minWidth={960}
      isLoading={loading && rows.length === 0}
      error={rows.length ? undefined : error}
      onRetry={onRetry}
      emptyTitle="No daily stats yet"
      emptyDescription="Rows appear once the first job has run."
      footerSlot={footer}
    />
  );
}
