/**
 * Columns of the Companies tab: one row per mention (`/companies`) or, with "One row per
 * company", the job's company flags (`/flags`). HQ city · scope, HQ state, industry and the
 * revenue bin come from the enrichment flags (mockup §3.6 footer).
 */
import { Link } from "@tanstack/react-router";
import type { ColumnDef } from "@tanstack/react-table";
import type { FlagRow } from "@/api/types/companies";
import type { CompanyMentionRow } from "@/api/types/signals";
import { MaterialityPill } from "@/components/MaterialityPill";
import { Meter } from "@/components/Meter";
import { RelativeTime } from "@/components/RelativeTime";
import { Tag } from "@/components/Tag";
import { formatInteger, formatScore } from "@/lib/format";
import { CompanyCell, DashCell, IndustryCell, PlaceCell, TextCell } from "./companyCells";

export function buildMentionColumns(jobId: string): ColumnDef<CompanyMentionRow, unknown>[] {
  return [
    {
      id: "company",
      header: "Company",
      meta: { hideable: false, minWidth: 220 },
      cell: ({ row }) => (
        <CompanyCell
          jobId={jobId}
          companyKey={row.original.company_key}
          name={row.original.company ?? row.original.name_as_written}
          orgKind={row.original.org_kind}
        />
      ),
    },
    {
      id: "role",
      header: "Role",
      meta: { width: 100 },
      cell: ({ row }) => <TextCell value={row.original.role} />,
    },
    {
      id: "confidence",
      header: "Confidence",
      meta: { width: 120 },
      cell: ({ row }) => (
        <Meter
          value={Number(row.original.confidence_score)}
          label={formatScore(row.original.confidence_score)}
          ariaLabel="Confidence"
        />
      ),
    },
    {
      id: "signal",
      header: "Signal",
      meta: { minWidth: 180 },
      cell: ({ row }) =>
        row.original.signal ? (
          <div className="flex flex-wrap items-center gap-2">
            <Link
              to="/signals"
              search={{ detail: String(row.original.id), detail_job: jobId }}
              className="font-medium text-ink hover:text-brand-700"
            >
              {row.original.signal_title ?? row.original.signal}
            </Link>
            <MaterialityPill materiality={row.original.materiality} />
          </div>
        ) : (
          <DashCell />
        ),
    },
    {
      id: "hq",
      header: "HQ city · scope",
      meta: { minWidth: 120 },
      cell: ({ row }) => (
        <PlaceCell place={row.original.scope_place} scope={row.original.hq_scope} />
      ),
    },
    {
      id: "hq_state",
      header: "HQ state",
      meta: { width: 90 },
      cell: ({ row }) => <TextCell value={row.original.hq_state} />,
    },
    {
      id: "industry",
      header: "Industry",
      meta: { minWidth: 140 },
      cell: ({ row }) => (
        <IndustryCell
          industry={row.original.company_industry}
          sub={row.original.company_sub_industry}
        />
      ),
    },
    {
      id: "revenue_bin",
      header: "Revenue bin",
      meta: { width: 110 },
      cell: ({ row }) => <TextCell value={row.original.revenue_bin} />,
    },
    {
      id: "article",
      header: "Article",
      meta: { minWidth: 160, maxWidth: 220 },
      cell: ({ row }) => (
        <div className="flex min-w-0 flex-col">
          <a
            href={row.original.url ?? undefined}
            target="_blank"
            rel="noopener noreferrer"
            className="truncate font-medium text-brand-600 hover:underline"
            title={row.original.title ?? undefined}
          >
            {row.original.source_domain}
          </a>
          <span className="truncate text-[11px] text-muted">{row.original.title}</span>
        </div>
      ),
    },
  ];
}

export function buildFlagColumns(jobId: string): ColumnDef<FlagRow, unknown>[] {
  return [
    {
      id: "company",
      header: "Company",
      meta: { hideable: false, minWidth: 220 },
      cell: ({ row }) => (
        <CompanyCell
          jobId={jobId}
          companyKey={row.original.company_key}
          name={row.original.company_name}
          orgKind={row.original.org_kind}
        />
      ),
    },
    {
      id: "hq",
      header: "HQ city · scope",
      meta: { minWidth: 120 },
      cell: ({ row }) => (
        <PlaceCell place={row.original.scope_place} scope={row.original.hq_scope} />
      ),
    },
    {
      id: "hq_county",
      header: "HQ county · state",
      meta: { minWidth: 130 },
      cell: ({ row }) =>
        row.original.hq_county || row.original.hq_state ? (
          `${row.original.hq_county || "—"} · ${row.original.hq_state || "—"}`
        ) : (
          <DashCell />
        ),
    },
    {
      id: "entity_flag",
      header: "Entity flag",
      meta: { width: 110 },
      cell: ({ row }) => <Tag>{row.original.entity_flag || "unknown"}</Tag>,
    },
    {
      id: "industry",
      header: "Industry",
      meta: { minWidth: 140 },
      cell: ({ row }) => (
        <IndustryCell
          industry={row.original.company_industry}
          sub={row.original.company_sub_industry}
        />
      ),
    },
    {
      id: "revenue_bin",
      header: "Revenue bin",
      meta: { width: 110 },
      cell: ({ row }) => (
        <div className="flex flex-col">
          <span>{row.original.revenue_bin || "unknown"}</span>
          <span className="text-[11px] text-muted">{row.original.revenue_basis || "—"}</span>
        </div>
      ),
    },
    {
      id: "articles",
      header: "Articles",
      meta: { align: "right", width: 90 },
      cell: ({ row }) => formatInteger(row.original.articles),
    },
    {
      id: "enrichment",
      header: "Enrichment",
      meta: { mono: true, minWidth: 140 },
      cell: ({ row }) =>
        `${row.original.enrichment_source || "—"} · ${row.original.enrichment_version || "—"}`,
    },
    {
      id: "updated",
      header: "Updated",
      meta: { width: 130 },
      cell: ({ row }) => <RelativeTime value={row.original.updated_at} mode="smart" />,
    },
  ];
}
