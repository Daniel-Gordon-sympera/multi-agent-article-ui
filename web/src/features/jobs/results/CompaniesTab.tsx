/**
 * Job › Companies — one row per mention (`/companies`) with org kind / HQ scope / industry
 * filters, or "One row per company" (`/flags`). Toolbar tools: density, columns, Export CSV
 * (companies.csv or company_flags.csv).
 */
import { useCallback, useMemo } from "react";
import { listJobCompanies, listJobFlags } from "@/api/pipeline";
import type { FlagRow } from "@/api/types/companies";
import type { CompanyMentionRow } from "@/api/types/signals";
import {
  ColumnChooser,
  DataTable,
  DensityToggle,
  useDataTableControls,
} from "@/components/DataTable";
import { FilterBar } from "@/components/FilterBar";
import { FilterSelect, toOptions } from "@/components/FilterSelect";
import { SearchInput } from "@/components/SearchInput";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { CsvExportButton } from "@/features/jobs/shared/CsvExportButton";
import type { TabProps } from "@/features/jobs/shared/tabProps";
import { matchesQuery, optionsFromRows } from "@/features/jobs/shared/tableSearch";
import type { CompaniesTabSearch } from "@/features/jobs/tabSearchSchemas";
import { useJobResourcePage } from "@/features/jobs/useJobResourcePage";
import { useJobDetail } from "@/features/jobs/useJobQueries";
import { buildFlagColumns, buildMentionColumns } from "./companiesColumns";

const ORG_KINDS = ["business", "gov", "nonprofit", "unknown"];
const HQ_SCOPES = ["local", "state", "national", "unknown"];
const REVENUE_BINS = [
  "<$1M",
  "$1M-$10M",
  "$10M-$20M",
  "$20M-$50M",
  "$50M-$100M",
  "$100M-$500M",
  ">$500M",
  "unknown",
  "NA",
];

export function CompaniesTab({
  jobId,
  search,
  patchFilters,
  patchTable,
}: TabProps<CompaniesTabSearch>) {
  const job = useJobDetail(jobId);
  const flagsView = search.view === "flags";
  const onAfterChange = useCallback(
    (after: string | undefined) => patchTable({ after }),
    [patchTable],
  );

  const mentionFilters = useMemo(
    () => ({ org_kind: search.org_kind, hq_scope: search.hq_scope, industry: search.industry }),
    [search.hq_scope, search.industry, search.org_kind],
  );
  const flagFilters = useMemo(
    () => ({
      org_kind: search.org_kind,
      hq_scope: search.hq_scope,
      revenue_bin: search.revenue_bin,
    }),
    [search.hq_scope, search.org_kind, search.revenue_bin],
  );
  const mentions = useJobResourcePage<CompanyMentionRow, typeof mentionFilters>({
    jobId,
    resource: "companies",
    filters: mentionFilters,
    fetchPage: listJobCompanies,
    jobStatus: job.data?.status,
    after: search.after,
    onAfterChange,
    enabled: !flagsView,
  });
  const flags = useJobResourcePage<FlagRow, typeof flagFilters>({
    jobId,
    resource: "flags",
    filters: flagFilters,
    fetchPage: listJobFlags,
    jobStatus: job.data?.status,
    after: search.after,
    onAfterChange,
    enabled: flagsView,
  });

  const mentionColumns = useMemo(() => buildMentionColumns(jobId), [jobId]);
  const flagColumns = useMemo(() => buildFlagColumns(jobId), [jobId]);
  const mentionControls = useDataTableControls({
    columns: mentionColumns,
    density: search.density,
    cols: flagsView ? undefined : search.cols,
    onChange: patchTable,
  });
  const flagControls = useDataTableControls({
    columns: flagColumns,
    density: search.density,
    cols: flagsView ? search.cols : undefined,
    onChange: patchTable,
  });
  const controls = flagsView ? flagControls : mentionControls;

  const mentionRows = useMemo(
    () =>
      mentions.items.filter((row) =>
        matchesQuery(search.q, [row.company, row.name_as_written, row.signal, row.title]),
      ),
    [mentions.items, search.q],
  );
  const flagRows = useMemo(
    () => flags.items.filter((row) => matchesQuery(search.q, [row.company_name, row.company_key])),
    [flags.items, search.q],
  );
  const industryOptions = optionsFromRows(
    mentions.items,
    (row) => row.company_industry,
    search.industry,
  );

  return (
    <div className="flex flex-col gap-4">
      <FilterBar
        tools={
          <>
            <div className="mr-2 flex items-center gap-2">
              <Switch
                id="companies-one-per-company"
                checked={flagsView}
                onCheckedChange={(checked) =>
                  patchFilters({
                    view: checked ? "flags" : undefined,
                    cols: undefined,
                    industry: undefined,
                  })
                }
              />
              <Label htmlFor="companies-one-per-company" className="cursor-pointer font-medium">
                One row per company
              </Label>
            </div>
            <DensityToggle {...controls.densityToggleProps} />
            <ColumnChooser {...controls.columnChooserProps} />
            <CsvExportButton jobId={jobId} table={flagsView ? "company_flags" : "companies"} />
          </>
        }
      >
        <SearchInput
          label="Search company"
          value={search.q}
          onValueChange={(q) => patchFilters({ q })}
          width={220}
        />
        <FilterSelect
          label="Org kind"
          value={search.org_kind}
          onValueChange={(org_kind) => patchFilters({ org_kind })}
          options={toOptions(ORG_KINDS)}
          width={120}
        />
        <FilterSelect
          label="HQ scope"
          value={search.hq_scope}
          onValueChange={(hq_scope) => patchFilters({ hq_scope })}
          options={toOptions(HQ_SCOPES)}
          width={120}
        />
        {flagsView ? (
          <FilterSelect
            label="Revenue bin"
            value={search.revenue_bin}
            onValueChange={(revenue_bin) => patchFilters({ revenue_bin })}
            options={toOptions(REVENUE_BINS)}
            width={130}
          />
        ) : (
          <FilterSelect
            label="Industry"
            value={search.industry}
            onValueChange={(industry) => patchFilters({ industry })}
            options={toOptions(industryOptions)}
            width={130}
          />
        )}
      </FilterBar>
      {flagsView ? (
        <DataTable
          ariaLabel="Companies of this job (one row per company)"
          columns={flagColumns}
          data={flagRows}
          getRowId={(row) => String(row.company_id)}
          rowHeight={52}
          minWidth={1000}
          {...flagControls.tableProps}
          isLoading={flags.query.isPending}
          error={flags.query.isError ? flags.query.error : undefined}
          onRetry={() => void flags.query.refetch()}
          emptyTitle="No company flags yet"
          emptyDescription="Flags are written by the enrichment stage once companies are extracted."
          pagination={{ ...flags.footer, noun: "company", pluralNoun: "companies" }}
        />
      ) : (
        <DataTable
          ariaLabel="Companies of this job"
          columns={mentionColumns}
          data={mentionRows}
          getRowId={(row) => String(row.id)}
          rowHeight={52}
          minWidth={1100}
          {...mentionControls.tableProps}
          isLoading={mentions.query.isPending}
          error={mentions.query.isError ? mentions.query.error : undefined}
          onRetry={() => void mentions.query.refetch()}
          emptyTitle="No company mentions yet"
          emptyDescription="Mentions appear as the analysis stage summarises articles."
          pagination={{
            ...mentions.footer,
            noun: "mention",
            note: "HQ city, state and industry come from the enrichment flags (scope_place, hq_state, company_industry)",
          }}
        />
      )}
    </div>
  );
}
