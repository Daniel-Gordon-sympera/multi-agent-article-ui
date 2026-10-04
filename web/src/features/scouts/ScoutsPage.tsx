/**
 * Jobs › Scouts (mockup §3.3): header + tabs, the brand note banner with "How Scouts work",
 * toolbar (search, State, Industry, density, columns) and the Scouts table; an empty state
 * with "New Scout" when nothing is saved. Polling `calm`.
 */
import { Link } from "@tanstack/react-router";
import { Bookmark } from "lucide-react";
import { useMemo } from "react";
import { useSession } from "@/app/providers/SessionProvider";
import { Button } from "@/components/Button";
import {
  ColumnChooser,
  DataTable,
  DensityToggle,
  useDataTableControls,
  type TableControlsPatch,
} from "@/components/DataTable";
import { EmptyState } from "@/components/EmptyState";
import { FilterBar } from "@/components/FilterBar";
import { FilterSelect, toOptions } from "@/components/FilterSelect";
import { NoteBanner } from "@/components/NoteBanner";
import { SearchInput } from "@/components/SearchInput";
import { JobsPageHeader } from "@/features/jobs/JobsPageHeader";
import type { ScoutsSearch } from "@/features/jobs/searchSchemas";
import { HowScoutsWorkLink } from "./HowScoutsWorkDialog";
import { scoutColumns } from "./scoutColumns";
import { NEW_SCOUT_SEARCH } from "./scoutLinks";
import { filterScouts, scoutIndustryOptions, scoutStateOptions } from "./scoutPresentation";
import { useActiveSources, useRunsCount, useScouts } from "./useScoutQueries";

export interface ScoutsPageProps {
  search: ScoutsSearch;
  onSearchChange: (patch: Partial<ScoutsSearch>) => void;
}

export function ScoutsPage({ search, onSearchChange }: ScoutsPageProps) {
  const { can } = useSession();
  const canOperate = can("operate");
  const scouts = useScouts();
  const sources = useActiveSources();
  const runsCount = useRunsCount();

  const columns = useMemo(
    () => scoutColumns({ sources: sources.data?.items, canOperate }),
    [sources.data?.items, canOperate],
  );
  const controls = useDataTableControls({
    columns,
    density: search.density,
    cols: search.cols,
    onChange: (patch: TableControlsPatch) => onSearchChange(patch),
  });

  const all = useMemo(() => scouts.data ?? [], [scouts.data]);
  const rows = useMemo(() => filterScouts(all, search), [all, search]);
  const filtered = Boolean(search.state || search.industry || search.q);
  const noScoutsAtAll = scouts.isSuccess && all.length === 0;

  return (
    <>
      <JobsPageHeader
        runsCount={runsCount.data ?? null}
        scoutsCount={scouts.data?.length ?? null}
      />
      <NoteBanner action={<HowScoutsWorkLink />}>
        A Scout is a saved setup: location, county, industries and sources. Running it creates one
        API job per industry; the runs stay listed under Runs.
      </NoteBanner>
      <FilterBar
        label="Scout filters"
        tools={
          <>
            <DensityToggle {...controls.densityToggleProps} />
            <ColumnChooser {...controls.columnChooserProps} />
          </>
        }
      >
        <SearchInput
          label="Search Scouts"
          width={280}
          value={search.q}
          onValueChange={(q) => onSearchChange({ q })}
        />
        <FilterSelect
          label="State"
          width={110}
          value={search.state}
          options={toOptions(scoutStateOptions(all))}
          onValueChange={(state) => onSearchChange({ state })}
        />
        <FilterSelect
          label="Industry"
          width={150}
          value={search.industry}
          options={toOptions(scoutIndustryOptions(all))}
          onValueChange={(industry) => onSearchChange({ industry })}
        />
      </FilterBar>
      {noScoutsAtAll ? (
        <EmptyState
          icon={<Bookmark />}
          title="No Scouts yet"
          description="Save a setup from the New run form to launch it again later with one click."
          action={
            canOperate ? (
              <Button asChild variant="primary">
                <Link to="/jobs/new" search={NEW_SCOUT_SEARCH}>
                  <Bookmark aria-hidden />
                  New Scout
                </Link>
              </Button>
            ) : undefined
          }
        />
      ) : (
        <DataTable
          ariaLabel="Scouts"
          columns={columns}
          data={rows}
          getRowId={(row) => row.id}
          minWidth={1100}
          rowHeight={48}
          isLoading={scouts.isPending}
          error={scouts.error}
          onRetry={() => void scouts.refetch()}
          emptyTitle={filtered ? "No Scouts match these filters" : "No Scouts yet"}
          emptyDescription={filtered ? "Clear a filter or search for another name." : undefined}
          {...controls.tableProps}
        />
      )}
    </>
  );
}
