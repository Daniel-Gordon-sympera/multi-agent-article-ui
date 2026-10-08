import { formatArticleDate } from "@/lib/articleDate";
/**
 * Columns of the Summaries tab: article (title / domain · date), main idea (2-line clamp),
 * focus topics, industry / sub-industry, article signal + materiality, companies count and the
 * "Record" action that opens the drawer.
 */
import type { ColumnDef } from "@tanstack/react-table";
import type { SummaryRow } from "@/api/types/summaries";
import { Button } from "@/components/Button";
import { MaterialityPill } from "@/components/MaterialityPill";
import { Tag } from "@/components/Tag";
import { formatInteger } from "@/lib/format";

const dash = <span className="text-muted">—</span>;

export function companiesCount(row: SummaryRow): number | null {
  return row.kept_count ?? null;
}

export function buildSummaryColumns(
  onRecord: (row: SummaryRow) => void,
): ColumnDef<SummaryRow, unknown>[] {
  return [
    {
      id: "article",
      header: "Article",
      meta: { hideable: false, minWidth: 220, maxWidth: 300 },
      cell: ({ row }) => (
        <div className="flex min-w-0 flex-col gap-0.5">
          <a
            href={row.original.url ?? undefined}
            target="_blank"
            rel="noopener noreferrer"
            className="truncate font-semibold text-ink hover:text-brand-700"
            title={row.original.title ?? undefined}
          >
            {row.original.title}
          </a>
          <span className="truncate text-[12px] text-muted">
            {row.original.source_domain} ·{" "}
            {formatArticleDate(row.original.date, row.original.date_precision)}
          </span>
        </div>
      ),
    },
    {
      id: "main_idea",
      header: "Main idea",
      meta: { minWidth: 260, maxWidth: 360 },
      cell: ({ row }) => (
        <p
          className="line-clamp-2 text-[13px] leading-snug text-ink-2"
          title={row.original.main_idea ?? ""}
        >
          {row.original.main_idea || dash}
        </p>
      ),
    },
    {
      id: "focus_topics",
      header: "Focus topics",
      meta: { minWidth: 160, defaultHidden: false },
      cell: ({ row }) =>
        row.original.focus_topics?.length ? (
          <div className="flex flex-wrap gap-1">
            {row.original.focus_topics.slice(0, 4).map((topic) => (
              <Tag key={topic}>{topic}</Tag>
            ))}
            {row.original.focus_topics.length > 4 ? (
              <span className="text-[11px] text-muted">
                +{row.original.focus_topics.length - 4}
              </span>
            ) : null}
          </div>
        ) : (
          dash
        ),
    },
    {
      id: "industry",
      header: "Industry",
      meta: { minWidth: 140 },
      cell: ({ row }) => (
        <div className="flex max-w-[160px] flex-col">
          <span className="truncate">{row.original.industry || "—"}</span>
          {row.original.sub_industry ? (
            <span className="truncate text-[11px] text-muted">{row.original.sub_industry}</span>
          ) : null}
        </div>
      ),
    },
    {
      id: "signal",
      header: "Article signal",
      meta: { minWidth: 170 },
      cell: ({ row }) =>
        row.original.article_signal ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{row.original.article_signal}</span>
            <MaterialityPill materiality={row.original.article_materiality} />
          </div>
        ) : (
          dash
        ),
    },
    {
      id: "companies",
      header: "Companies",
      meta: { align: "right", width: 100 },
      cell: ({ row }) => {
        const count = companiesCount(row.original);
        return count === null ? "—" : formatInteger(count);
      },
    },
    {
      id: "flags",
      header: "Flags",
      meta: { width: 110, defaultHidden: true },
      cell: ({ row }) => {
        const flags = [
          row.original.sponsored ? "sponsored" : null,
          row.original.is_list_page ? "list page" : null,
          row.original.warnings?.length ? `${row.original.warnings.length} warnings` : null,
        ].filter(Boolean);
        return flags.length ? flags.join(" · ") : dash;
      },
    },
    {
      id: "actions",
      header: "Actions",
      meta: { actions: true, align: "right", hideable: false, interactive: true },
      cell: ({ row }) => (
        <Button
          variant="ghost"
          size="xs"
          onClick={() => onRecord(row.original)}
          aria-label={`Summary record of ${row.original.title}`}
        >
          Record
        </Button>
      ),
    },
  ];
}
