/**
 * Columns of the finder tables on the Site runs tab: judged sources (`/sources`) and the
 * ranking (`/ranking`) of a `location_industry` job.
 */
import { Check } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import type { FinderSourceRow, RankingRow } from "@/api/types/finder";
import { StatusPill } from "@/components/StatusPill";
import { Tag } from "@/components/Tag";
import type { StatusDescriptor } from "@/lib/status";
import { DomainCell } from "./DomainCell";

function verdictDescriptor(verdict: string): StatusDescriptor {
  const v = verdict.toLowerCase();
  if (v === "accept" || v === "keep") return { tone: "done", label: v, indicator: "dot" };
  if (v === "reject") return { tone: "neutral", label: v, indicator: "dot" };
  return { tone: "warn", label: verdict || "—", indicator: "dot" };
}

export const FINDER_SOURCE_COLUMNS: ColumnDef<FinderSourceRow, unknown>[] = [
  {
    id: "domain",
    header: "Domain",
    meta: { hideable: false, minWidth: 200 },
    cell: ({ row }) => (
      <DomainCell name={row.original.name} url={row.original.url} domain={row.original.domain} />
    ),
  },
  {
    id: "verdict",
    header: "Verdict",
    meta: { width: 110 },
    cell: ({ row }) => (
      <StatusPill descriptor={verdictDescriptor(row.original.verdict)} size="sm" />
    ),
  },
  {
    id: "coverage",
    header: "Coverage",
    meta: { width: 100 },
    cell: ({ row }) => <Tag>{row.original.coverage || "—"}</Tag>,
  },
  {
    id: "relevance",
    header: "Relevance",
    meta: { width: 100 },
    cell: ({ row }) => <Tag>{row.original.relevance || "—"}</Tag>,
  },
  {
    id: "reason",
    header: "Reason",
    meta: { minWidth: 220 },
    cell: ({ row }) => (
      <span className="line-clamp-2 text-[12px] text-ink-2" title={row.original.reason}>
        {row.original.reason}
      </span>
    ),
  },
  {
    id: "origin",
    header: "Origin",
    meta: { width: 90, mono: true },
    cell: ({ row }) => row.original.origin,
  },
  {
    id: "round",
    header: "Round",
    meta: { align: "right", width: 70 },
    cell: ({ row }) => row.original.round ?? "—",
  },
];

export const RANKING_COLUMNS: ColumnDef<RankingRow, unknown>[] = [
  {
    id: "rank",
    header: "#",
    meta: { align: "right", width: 56 },
    cell: ({ row }) => row.original.overall_rank,
  },
  {
    id: "site",
    header: "Site",
    meta: { hideable: false, minWidth: 200 },
    cell: ({ row }) => (
      <DomainCell
        name={row.original.name}
        url={row.original.url}
        domain={row.original.url.replace(/^https?:\/\//, "").replace(/^www\./, "")}
      />
    ),
  },
  {
    id: "tier",
    header: "Tier",
    meta: { width: 90 },
    cell: ({ row }) => <Tag tone="brand">tier {row.original.tier}</Tag>,
  },
  {
    id: "chosen",
    header: "Chosen",
    meta: { width: 80 },
    cell: ({ row }) =>
      row.original.chosen ? (
        <span className="inline-flex items-center gap-1 text-status-done-fg">
          <Check size={14} strokeWidth={2.5} aria-hidden /> yes
        </span>
      ) : (
        <span className="text-muted">no</span>
      ),
  },
  {
    id: "pages_opened",
    header: "Pages opened",
    meta: { align: "right", width: 110 },
    cell: ({ row }) => row.original.pages_opened,
  },
  {
    id: "coverage",
    header: "Coverage · relevance",
    meta: { minWidth: 150 },
    cell: ({ row }) => `${row.original.coverage ?? "—"} · ${row.original.relevance ?? "—"}`,
  },
  {
    id: "reason",
    header: "Reason",
    meta: { minWidth: 220 },
    cell: ({ row }) => (
      <span className="line-clamp-2 text-[12px] text-ink-2" title={row.original.reason}>
        {row.original.reason}
      </span>
    ),
  },
];
