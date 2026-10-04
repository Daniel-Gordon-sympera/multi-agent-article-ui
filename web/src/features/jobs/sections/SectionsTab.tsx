/**
 * Job › Sections — the sections the Sections agent recorded per site (`/sections`): domain,
 * section URL / title, kept pill, reason, origin; kept and origin filters; `sections.csv`.
 */
import type { ColumnDef } from "@tanstack/react-table";
import { useCallback, useMemo } from "react";
import { listJobSections } from "@/api/pipeline";
import type { SectionRow } from "@/api/types/sections";
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
import { StatusPill } from "@/components/StatusPill";
import { Tag } from "@/components/Tag";
import { CsvExportButton } from "@/features/jobs/shared/CsvExportButton";
import type { TabProps } from "@/features/jobs/shared/tabProps";
import { matchesQuery, optionsFromRows } from "@/features/jobs/shared/tableSearch";
import type { SectionsTabSearch } from "@/features/jobs/tabSearchSchemas";
import { useJobResourcePage } from "@/features/jobs/useJobResourcePage";
import { useJobDetail } from "@/features/jobs/useJobQueries";
import { domainOf } from "@/lib/url";

function sectionDomain(row: SectionRow): string {
  return row.domain ?? domainOf(row.url);
}

const columns: ColumnDef<SectionRow, unknown>[] = [
  {
    id: "domain",
    header: "Domain",
    meta: { minWidth: 160 },
    cell: ({ row }) => <span className="font-medium text-ink">{sectionDomain(row.original)}</span>,
  },
  {
    id: "section",
    header: "Section",
    meta: { hideable: false, minWidth: 260, maxWidth: 380 },
    cell: ({ row }) => (
      <div className="flex min-w-0 flex-col gap-0.5">
        <a
          href={row.original.url}
          target="_blank"
          rel="noopener noreferrer"
          className="truncate font-semibold text-ink hover:text-brand-700"
          title={row.original.url}
        >
          {row.original.title || row.original.url}
        </a>
        <span className="truncate text-[12px] text-muted">{row.original.url}</span>
      </div>
    ),
  },
  {
    id: "kept",
    header: "Kept",
    meta: { width: 100 },
    cell: ({ row }) => (
      <StatusPill
        size="sm"
        descriptor={
          row.original.kept
            ? { tone: "done", label: "Kept", indicator: "dot" }
            : { tone: "neutral", label: "Skipped", indicator: "dot" }
        }
      />
    ),
  },
  {
    id: "reason",
    header: "Reason",
    meta: { minWidth: 220 },
    cell: ({ row }) => (
      <span className="line-clamp-2 text-[12px] text-ink-2" title={row.original.reason}>
        {row.original.reason || "—"}
      </span>
    ),
  },
  {
    id: "origin",
    header: "Origin",
    meta: { width: 100 },
    cell: ({ row }) => <Tag mono>{row.original.origin}</Tag>,
  },
  {
    id: "section_id",
    header: "Section id",
    meta: { align: "right", width: 90, defaultHidden: true },
    cell: ({ row }) => row.original.section_id ?? "—",
  },
  {
    id: "recorded",
    header: "Recorded",
    meta: { width: 130 },
    cell: ({ row }) => <RelativeTime value={row.original.recorded_at} mode="smart" />,
  },
];

export function SectionsTab({
  jobId,
  search,
  patchFilters,
  patchTable,
}: TabProps<SectionsTabSearch>) {
  const job = useJobDetail(jobId);
  const onAfterChange = useCallback(
    (after: string | undefined) => patchTable({ after }),
    [patchTable],
  );
  const filters = useMemo(
    () => ({ kept: search.kept, origin: search.origin }),
    [search.kept, search.origin],
  );
  const page = useJobResourcePage<SectionRow, typeof filters>({
    jobId,
    resource: "sections",
    filters,
    fetchPage: listJobSections,
    jobStatus: job.data?.status,
    kind: "operations",
    after: search.after,
    onAfterChange,
  });
  const controls = useDataTableControls({
    columns,
    density: search.density,
    cols: search.cols,
    onChange: patchTable,
  });
  const rows = useMemo(
    () =>
      page.items.filter((row) =>
        matchesQuery(search.q, [sectionDomain(row), row.title, row.url, row.reason]),
      ),
    [page.items, search.q],
  );

  return (
    <div className="flex flex-col gap-4">
      <FilterBar
        tools={
          <>
            <DensityToggle {...controls.densityToggleProps} />
            <ColumnChooser {...controls.columnChooserProps} />
            <CsvExportButton jobId={jobId} table="sections" />
          </>
        }
      >
        <SearchInput
          label="Search domain or section"
          value={search.q}
          onValueChange={(q) => patchFilters({ q })}
          width={230}
        />
        <FilterSelect
          label="Kept"
          value={search.kept}
          onValueChange={(kept) => patchFilters({ kept: kept as SectionsTabSearch["kept"] })}
          options={[
            { value: "true", label: "kept" },
            { value: "false", label: "skipped" },
          ]}
          width={110}
        />
        <FilterSelect
          label="Origin"
          value={search.origin}
          onValueChange={(origin) => patchFilters({ origin })}
          options={toOptions(optionsFromRows(page.items, (row) => row.origin, search.origin))}
          width={110}
        />
      </FilterBar>
      <DataTable
        ariaLabel="Sections of this job"
        columns={columns}
        data={rows}
        getRowId={(row) => String(row.id)}
        rowHeight={52}
        minWidth={1000}
        {...controls.tableProps}
        isLoading={page.query.isPending}
        error={page.query.isError ? page.query.error : undefined}
        onRetry={() => void page.query.refetch()}
        emptyTitle="No sections recorded yet"
        emptyDescription="The Sections agent records the kept and skipped sections of each explored site."
        pagination={{ ...page.footer, noun: "section" }}
      />
    </div>
  );
}
