/**
 * Job › Articles — the accepted articles (`/articles`): title/url, domain, published date,
 * accepted at, origin, saved text availability; filters domain / origin; "Saved text" opens the
 * streaming dialog; `articles.csv`.
 */
import type { ColumnDef } from "@tanstack/react-table";
import { useCallback, useMemo, useState } from "react";
import { listJobArticles } from "@/api/pipeline";
import type { ArticleRow } from "@/api/types/articles";
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
import { SearchInput } from "@/components/SearchInput";
import { Tag } from "@/components/Tag";
import { CsvExportButton } from "@/features/jobs/shared/CsvExportButton";
import type { TabProps } from "@/features/jobs/shared/tabProps";
import { matchesQuery, optionsFromRows } from "@/features/jobs/shared/tableSearch";
import type { ArticlesTabSearch } from "@/features/jobs/tabSearchSchemas";
import { useJobResourcePage } from "@/features/jobs/useJobResourcePage";
import { useJobDetail } from "@/features/jobs/useJobQueries";
import { formatDate } from "@/lib/format";
import { ArticleTextDialog } from "./ArticleTextDialog";

const ORIGINS = ["fetched", "memory"];

function buildArticleColumns(onText: (row: ArticleRow) => void): ColumnDef<ArticleRow, unknown>[] {
  return [
    {
      id: "title",
      header: "Article",
      meta: { hideable: false, minWidth: 280, maxWidth: 420 },
      cell: ({ row }) => (
        <div className="flex min-w-0 flex-col gap-0.5">
          <a
            href={row.original.canonical_url}
            target="_blank"
            rel="noopener noreferrer"
            className="truncate font-semibold text-ink hover:text-brand-700"
            title={row.original.title}
          >
            {row.original.title}
          </a>
          <span className="truncate text-[12px] text-muted">{row.original.canonical_url}</span>
        </div>
      ),
    },
    {
      id: "domain",
      header: "Domain",
      meta: { minWidth: 150 },
      cell: ({ row }) => row.original.domain,
    },
    {
      id: "published",
      header: "Published",
      meta: { width: 120 },
      cell: ({ row }) => formatDate(row.original.published_date),
    },
    {
      id: "accepted",
      header: "Accepted",
      meta: { width: 140 },
      cell: ({ row }) => <RelativeTime value={row.original.accepted_at} mode="smart" />,
    },
    {
      id: "origin",
      header: "Origin",
      meta: { width: 100 },
      cell: ({ row }) => <Tag>{row.original.origin}</Tag>,
    },
    {
      id: "text",
      header: "Saved text",
      meta: { width: 120 },
      cell: ({ row }) =>
        row.original.text_sha ? (
          <span className="font-mono text-[11px] text-ink-2">
            {row.original.text_sha.slice(0, 10)}
          </span>
        ) : (
          <span className="text-muted">not saved</span>
        ),
    },
    {
      id: "article_id",
      header: "Id",
      meta: { mono: true, width: 90, defaultHidden: true },
      cell: ({ row }) => `#${row.original.id}`,
    },
    {
      id: "actions",
      header: "Actions",
      meta: { actions: true, align: "right", hideable: false, interactive: true },
      cell: ({ row }) => (
        <Button
          variant="secondary"
          size="xs"
          disabled={!row.original.text_sha}
          onClick={() => onText(row.original)}
          aria-label={`Saved text of ${row.original.title}`}
        >
          Saved text
        </Button>
      ),
    },
  ];
}

export function ArticlesTab({
  jobId,
  search,
  patchFilters,
  patchTable,
}: TabProps<ArticlesTabSearch>) {
  const job = useJobDetail(jobId);
  const [textArticle, setTextArticle] = useState<ArticleRow | null>(null);
  const onAfterChange = useCallback(
    (after: string | undefined) => patchTable({ after }),
    [patchTable],
  );
  const filters = useMemo(
    () => ({ domain: search.domain, origin: search.origin }),
    [search.domain, search.origin],
  );
  const page = useJobResourcePage<ArticleRow, typeof filters>({
    jobId,
    resource: "articles",
    filters,
    fetchPage: listJobArticles,
    jobStatus: job.data?.status,
    after: search.after,
    onAfterChange,
  });
  const columns = useMemo(() => buildArticleColumns(setTextArticle), []);
  const controls = useDataTableControls({
    columns,
    density: search.density,
    cols: search.cols,
    onChange: patchTable,
  });
  const rows = useMemo(
    () => page.items.filter((row) => matchesQuery(search.q, [row.title, row.canonical_url])),
    [page.items, search.q],
  );

  return (
    <div className="flex flex-col gap-4">
      <FilterBar
        tools={
          <>
            <DensityToggle {...controls.densityToggleProps} />
            <ColumnChooser {...controls.columnChooserProps} />
            <CsvExportButton jobId={jobId} table="articles" />
          </>
        }
      >
        <SearchInput
          label="Search title or URL"
          value={search.q}
          onValueChange={(q) => patchFilters({ q })}
          width={240}
        />
        <FilterSelect
          label="Domain"
          value={search.domain}
          onValueChange={(domain) => patchFilters({ domain })}
          options={toOptions(optionsFromRows(page.items, (row) => row.domain, search.domain))}
          width={160}
        />
        <FilterSelect
          label="Origin"
          value={search.origin}
          onValueChange={(origin) => patchFilters({ origin })}
          options={toOptions(ORIGINS)}
          width={110}
        />
      </FilterBar>
      <DataTable
        ariaLabel="Articles of this job"
        columns={columns}
        data={rows}
        getRowId={(row) => String(row.id)}
        rowHeight={52}
        minWidth={1000}
        {...controls.tableProps}
        isLoading={page.query.isPending}
        error={page.query.isError ? page.query.error : undefined}
        onRetry={() => void page.query.refetch()}
        emptyTitle="No articles yet"
        emptyDescription="Articles are accepted during discovery, once the classifier keeps a candidate."
        pagination={{ ...page.footer, noun: "article" }}
      />
      <ArticleTextDialog article={textArticle} onClose={() => setTextArticle(null)} />
    </div>
  );
}
