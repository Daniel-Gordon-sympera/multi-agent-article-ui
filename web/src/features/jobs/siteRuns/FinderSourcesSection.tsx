/**
 * "Finder sources & ranking" — only for `location_industry` jobs: the judged domains
 * (`/sources?verdict=`) and the ranking (`/ranking?tier=&chosen=`) with their CSV exports.
 */
import { useMemo } from "react";
import { listJobRanking, listJobSources } from "@/api/pipeline";
import type { FinderSourceRow, RankingRow } from "@/api/types/finder";
import { SectionHeader } from "@/components/Card";
import { DataTable } from "@/components/DataTable";
import { FilterBar } from "@/components/FilterBar";
import { FilterSelect, toOptions } from "@/components/FilterSelect";
import { CsvExportButton } from "@/features/jobs/shared/CsvExportButton";
import { optionsFromRows } from "@/features/jobs/shared/tableSearch";
import type { SiteRunsTabSearch } from "@/features/jobs/tabSearchSchemas";
import { useJobResourcePage } from "@/features/jobs/useJobResourcePage";
import { FINDER_SOURCE_COLUMNS, RANKING_COLUMNS } from "./finderColumns";

export interface FinderSourcesSectionProps {
  jobId: string;
  jobStatus: string | undefined;
  search: SiteRunsTabSearch;
  onPatch: (patch: Partial<SiteRunsTabSearch>) => void;
}

export function FinderSourcesSection({
  jobId,
  jobStatus,
  search,
  onPatch,
}: FinderSourcesSectionProps) {
  const sourceFilters = useMemo(() => ({ verdict: search.verdict }), [search.verdict]);
  const rankingFilters = useMemo(
    () => ({ tier: search.tier, chosen: search.chosen }),
    [search.chosen, search.tier],
  );
  const sources = useJobResourcePage<FinderSourceRow, typeof sourceFilters>({
    jobId,
    resource: "sources",
    filters: sourceFilters,
    fetchPage: listJobSources,
    jobStatus,
    kind: "operations",
    limit: 100,
  });
  const ranking = useJobResourcePage<RankingRow, typeof rankingFilters>({
    jobId,
    resource: "ranking",
    filters: rankingFilters,
    fetchPage: listJobRanking,
    jobStatus,
    kind: "operations",
    limit: 100,
  });

  return (
    <section aria-labelledby="finder-sources-title" className="flex flex-col gap-3">
      <SectionHeader
        title={<span id="finder-sources-title">Finder sources &amp; ranking</span>}
        subtitle="Domains the finder judged for this location and industry, then the ranked shortlist it explored"
      />
      <FilterBar
        label="Finder source filters"
        tools={<CsvExportButton jobId={jobId} table="sources" label="sources.csv" />}
      >
        <FilterSelect
          label="Verdict"
          value={search.verdict}
          onValueChange={(verdict) => onPatch({ verdict })}
          options={toOptions(optionsFromRows(sources.items, (row) => row.verdict, search.verdict))}
          width={120}
        />
      </FilterBar>
      <DataTable
        ariaLabel="Finder sources"
        columns={FINDER_SOURCE_COLUMNS}
        data={sources.items}
        getRowId={(row) => `${row.search_id}:${row.domain}`}
        rowHeight={48}
        minWidth={900}
        maxHeight={420}
        isLoading={sources.query.isPending}
        error={sources.query.isError ? sources.query.error : undefined}
        onRetry={() => void sources.query.refetch()}
        emptyTitle="No judged domains"
        emptyDescription="The finder records every domain it judged once the search has run."
        pagination={
          sources.hasNext || sources.hasPrev ? { ...sources.footer, noun: "domain" } : undefined
        }
      />
      <FilterBar
        label="Ranking filters"
        tools={<CsvExportButton jobId={jobId} table="site_ranking" label="site_ranking.csv" />}
      >
        <FilterSelect
          label="Tier"
          value={search.tier}
          onValueChange={(tier) => onPatch({ tier })}
          options={toOptions(
            optionsFromRows(ranking.items, (row) => String(row.tier), search.tier),
          )}
          width={100}
        />
        <FilterSelect
          label="Chosen"
          value={search.chosen}
          onValueChange={(chosen) => onPatch({ chosen: chosen as SiteRunsTabSearch["chosen"] })}
          options={[
            { value: "true", label: "chosen" },
            { value: "false", label: "not chosen" },
          ]}
          width={110}
        />
      </FilterBar>
      <DataTable
        ariaLabel="Site ranking"
        columns={RANKING_COLUMNS}
        data={ranking.items}
        getRowId={(row) => row.url}
        rowHeight={48}
        minWidth={900}
        maxHeight={420}
        isLoading={ranking.query.isPending}
        error={ranking.query.isError ? ranking.query.error : undefined}
        onRetry={() => void ranking.query.refetch()}
        emptyTitle="No ranking yet"
        emptyDescription="The ranker lists the kept domains with their tier once the finder has judged them."
        pagination={
          ranking.hasNext || ranking.hasPrev ? { ...ranking.footer, noun: "site" } : undefined
        }
      />
    </section>
  );
}
