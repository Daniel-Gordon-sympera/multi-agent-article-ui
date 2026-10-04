/**
 * Job › Site runs — the same table as the Overview section with a status filter, density /
 * columns / `chosen_seeds.csv`, plus the finder section for `location_industry` jobs.
 */
import { useCallback, useMemo } from "react";
import { listJobSiteRuns } from "@/api/pipeline";
import type { SiteRun } from "@/api/types/siteRuns";
import { ColumnChooser, DensityToggle, useDataTableControls } from "@/components/DataTable";
import { FilterBar } from "@/components/FilterBar";
import { FilterSelect, toOptions } from "@/components/FilterSelect";
import { CsvExportButton } from "@/features/jobs/shared/CsvExportButton";
import type { TabProps } from "@/features/jobs/shared/tabProps";
import type { SiteRunsTabSearch } from "@/features/jobs/tabSearchSchemas";
import { useJobResourcePage } from "@/features/jobs/useJobResourcePage";
import { useJobDetail } from "@/features/jobs/useJobQueries";
import { FinderSourcesSection } from "./FinderSourcesSection";
import { SITE_RUN_COLUMNS } from "./siteRunsColumns";
import { SiteRunsTable } from "./SiteRunsTable";

const SITE_RUN_STATUSES = [
  "queued",
  "exploring",
  "no_sections",
  "discovering",
  "finished",
  "partial",
  "failed",
  "cancelled",
];

export function SiteRunsTab({
  jobId,
  search,
  patchFilters,
  patchTable,
}: TabProps<SiteRunsTabSearch>) {
  const job = useJobDetail(jobId);
  const onAfterChange = useCallback(
    (after: string | undefined) => patchTable({ after }),
    [patchTable],
  );
  const filters = useMemo(() => ({ status: search.status }), [search.status]);
  const page = useJobResourcePage<SiteRun, typeof filters>({
    jobId,
    resource: "site-runs",
    filters,
    fetchPage: listJobSiteRuns,
    jobStatus: job.data?.status,
    kind: "operations",
    after: search.after,
    onAfterChange,
  });
  const controls = useDataTableControls({
    columns: SITE_RUN_COLUMNS,
    density: search.density,
    cols: search.cols,
    onChange: patchTable,
  });

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-4">
        <FilterBar
          tools={
            <>
              <DensityToggle {...controls.densityToggleProps} />
              <ColumnChooser {...controls.columnChooserProps} />
              <CsvExportButton jobId={jobId} table="chosen_seeds" />
            </>
          }
        >
          <FilterSelect
            label="Status"
            value={search.status}
            onValueChange={(status) => patchFilters({ status })}
            options={toOptions(SITE_RUN_STATUSES, (v) => v.replace(/_/g, " "))}
            width={130}
          />
        </FilterBar>
        <SiteRunsTable
          job={job.data ?? { kind: "location_industry" }}
          page={page}
          tableProps={controls.tableProps}
        />
      </div>
      {job.data?.kind === "location_industry" ? (
        <FinderSourcesSection
          jobId={jobId}
          jobStatus={job.data.status}
          search={search}
          onPatch={patchFilters}
        />
      ) : null}
    </div>
  );
}
