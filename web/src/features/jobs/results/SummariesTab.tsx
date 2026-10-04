/**
 * Job › Summaries — the analysis rows of this job (`/summaries`) with industry / materiality /
 * signal filters, a client-side search, the record drawer and `summaries.csv`.
 */
import { useCallback, useMemo } from "react";
import { listJobSummaries } from "@/api/pipeline";
import type { SummaryRow } from "@/api/types/summaries";
import {
  ColumnChooser,
  DataTable,
  DensityToggle,
  useDataTableControls,
} from "@/components/DataTable";
import { FilterBar } from "@/components/FilterBar";
import { FilterSelect, toOptions } from "@/components/FilterSelect";
import { SearchInput } from "@/components/SearchInput";
import { CsvExportButton } from "@/features/jobs/shared/CsvExportButton";
import type { TabProps } from "@/features/jobs/shared/tabProps";
import { matchesQuery, optionsFromRows } from "@/features/jobs/shared/tableSearch";
import type { SummariesTabSearch } from "@/features/jobs/tabSearchSchemas";
import { useJobResourcePage } from "@/features/jobs/useJobResourcePage";
import { useJobDetail } from "@/features/jobs/useJobQueries";
import { buildSummaryColumns } from "./summariesColumns";
import { SummaryRecordDrawer } from "./SummaryRecordDrawer";

const MATERIALITIES = ["High", "Medium", "Low"];

export function SummariesTab({
  jobId,
  search,
  patchFilters,
  patchTable,
}: TabProps<SummariesTabSearch>) {
  const job = useJobDetail(jobId);
  const onAfterChange = useCallback(
    (after: string | undefined) => patchTable({ after }),
    [patchTable],
  );
  const filters = useMemo(
    () => ({ industry: search.industry, materiality: search.materiality, signal: search.signal }),
    [search.industry, search.materiality, search.signal],
  );
  const page = useJobResourcePage<SummaryRow, typeof filters>({
    jobId,
    resource: "summaries",
    filters,
    fetchPage: listJobSummaries,
    jobStatus: job.data?.status,
    after: search.after,
    onAfterChange,
  });
  const columns = useMemo(
    () => buildSummaryColumns((row) => patchTable({ record: String(row.id) })),
    [patchTable],
  );
  const controls = useDataTableControls({
    columns,
    density: search.density,
    cols: search.cols,
    onChange: patchTable,
  });
  const rows = useMemo(
    () =>
      page.items.filter((row) =>
        matchesQuery(search.q, [row.title, row.main_idea, row.source_domain, row.article_signal]),
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
            <CsvExportButton jobId={jobId} table="summaries" />
          </>
        }
      >
        <SearchInput
          label="Search title or main idea"
          value={search.q}
          onValueChange={(q) => patchFilters({ q })}
          width={240}
        />
        <FilterSelect
          label="Industry"
          value={search.industry}
          onValueChange={(industry) => patchFilters({ industry })}
          options={toOptions(optionsFromRows(page.items, (row) => row.industry, search.industry))}
          width={130}
        />
        <FilterSelect
          label="Materiality"
          value={search.materiality}
          onValueChange={(materiality) => patchFilters({ materiality })}
          options={toOptions(MATERIALITIES)}
          width={130}
        />
        <FilterSelect
          label="Signal"
          value={search.signal}
          onValueChange={(signal) => patchFilters({ signal })}
          options={toOptions(
            optionsFromRows(page.items, (row) => row.article_signal, search.signal),
          )}
          width={150}
        />
      </FilterBar>
      <DataTable
        ariaLabel="Summaries of this job"
        columns={columns}
        data={rows}
        getRowId={(row) => String(row.id)}
        rowHeight={64}
        minWidth={1100}
        {...controls.tableProps}
        isLoading={page.query.isPending}
        error={page.query.isError ? page.query.error : undefined}
        onRetry={() => void page.query.refetch()}
        emptyTitle="No summaries yet"
        emptyDescription="Summaries appear as the analysis stage works through the accepted articles."
        pagination={{ ...page.footer, noun: "summary", pluralNoun: "summaries" }}
      />
      <SummaryRecordDrawer rows={page.items} />
    </div>
  );
}
