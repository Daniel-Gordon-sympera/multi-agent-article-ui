/**
 * Jobs › Runs — mockup §3.2: header + tabs, toolbar, the Runs table (rows 48, min-width 1000)
 * and the keyset pagination footer. `?scout=<id>` narrows the list to one Scout's runs and
 * shows a removable chip (cross-feature contract §7).
 */
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { useCallback, useMemo } from "react";
import { listScouts } from "@/api/bff";
import { qk } from "@/api/keys";
import { pollingOptions } from "@/api/polling";
import { useSession } from "@/app/providers/SessionProvider";
import { Button } from "@/components/Button";
import {
  ColumnChooser,
  DataTable,
  DensityToggle,
  useDataTableControls,
} from "@/components/DataTable";
import { EmptyState } from "@/components/EmptyState";
import { FilterChips } from "@/components/FilterChips";
import { JobsPageHeader } from "@/features/jobs/JobsPageHeader";
import type { JobsSearch } from "@/features/jobs/searchSchemas";
import { filterUpdater, searchUpdater } from "@/features/jobs/shared/tableSearch";
import { RUNS_COLUMNS } from "./runsColumns";
import { RunsColumnContext } from "./runsFacts";
import { downloadRunsCsv } from "./runsCsv";
import { RunsToolbar } from "./RunsToolbar";
import { useRunsData } from "./useRunsData";

export function RunsPage({ search }: { search: JobsSearch }) {
  const navigate = useNavigate({ from: "/jobs/" });
  const { can } = useSession();

  const patchFilters = useCallback(
    (patch: Partial<JobsSearch>) =>
      void navigate({ search: filterUpdater<JobsSearch>(patch), replace: true }),
    [navigate],
  );
  const patchTable = useCallback(
    (patch: Partial<JobsSearch>) =>
      void navigate({ search: searchUpdater<JobsSearch>(patch), replace: true }),
    [navigate],
  );
  const onAfterChange = useCallback(
    (after: string | undefined) => patchTable({ after }),
    [patchTable],
  );

  const data = useRunsData(search, onAfterChange);
  const scouts = useQuery({
    queryKey: qk.app.scouts(),
    queryFn: listScouts,
    ...pollingOptions("calm"),
  });

  const facts = useMemo(
    () => ({ progress: data.progress, batches: data.batches }),
    [data.batches, data.progress],
  );
  const controls = useDataTableControls({
    columns: RUNS_COLUMNS,
    density: search.density,
    cols: search.cols,
    onChange: patchTable,
  });

  const filtered = data.rows.length !== data.allRows.length;
  const runsCount = data.page.hasNext || data.page.pageIndex > 0 ? undefined : data.rows.length;
  const hasActiveFilters = Boolean(
    search.q || search.status || search.state || search.county || search.industry,
  );

  return (
    <>
      <JobsPageHeader runsCount={runsCount} scoutsCount={scouts.data?.length} />
      {search.scout ? (
        <FilterChips
          chips={[
            {
              key: "scout",
              label: `Runs of Scout ${data.scout?.name ?? "…"}`,
              description: "Scout",
              onRemove: () => patchFilters({ scout: undefined }),
            },
          ]}
          summary={
            data.scoutError ? (
              "This Scout could not be loaded; showing its runs by id."
            ) : (
              <Link to="/jobs/scouts">All Scouts ›</Link>
            )
          }
        />
      ) : null}
      <RunsToolbar
        search={search}
        rows={data.allRows}
        onPatch={patchFilters}
        industryOnApi={data.industryOnApi}
        tools={
          <>
            <DensityToggle {...controls.densityToggleProps} />
            <ColumnChooser {...controls.columnChooserProps} />
          </>
        }
        onExport={() =>
          downloadRunsCsv(data.rows, { progress: data.progress, batches: data.batches })
        }
        exportDisabled={data.rows.length === 0}
      />
      <RunsColumnContext.Provider value={facts}>
        <DataTable
          ariaLabel="Runs"
          columns={RUNS_COLUMNS}
          data={data.rows}
          getRowId={(job) => job.id}
          rowHeight={48}
          minWidth={1000}
          {...controls.tableProps}
          isLoading={data.page.query.isPending}
          error={data.page.query.isError ? data.page.query.error : undefined}
          onRetry={() => void data.page.query.refetch()}
          emptyState={
            <EmptyState
              variant="plain"
              title={filtered || hasActiveFilters ? "No runs match these filters" : "No runs yet"}
              description={
                filtered || hasActiveFilters
                  ? "Widen the Created range or clear a filter; the search and the industry filter only look at the loaded page."
                  : "Launch the first run from New run; it appears here within a few seconds."
              }
              action={
                hasActiveFilters ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() =>
                      patchFilters({
                        q: undefined,
                        status: undefined,
                        state: undefined,
                        county: undefined,
                        industry: undefined,
                      })
                    }
                  >
                    Clear filters
                  </Button>
                ) : can("operate") ? (
                  <Button asChild variant="primary" size="sm">
                    <Link to="/jobs/new">
                      <Plus aria-hidden />
                      New run
                    </Link>
                  </Button>
                ) : undefined
              }
            />
          }
          pagination={{
            ...data.page.footer,
            noun: "run",
            note: filtered
              ? `${data.rows.length} of ${data.allRows.length} loaded runs match`
              : null,
          }}
        />
      </RunsColumnContext.Provider>
    </>
  );
}
