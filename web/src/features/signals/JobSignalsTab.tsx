/**
 * Job › Signals tab (`/jobs/$jobId/signals`, mockup §3.6): toolbar (search, Signal, Materiality,
 * Org kind, HQ scope, Industry, Revenue bin · density, columns, `signals.csv`), the shared
 * SignalsTable on `GET /v1/jobs/{id}/signals` (server filters where the API has them, the rest
 * over the page), the footer with "N signals · M companies" and the flags sentence, and the
 * URL-bound drawer. The summary strip above comes from the `$jobId` layout.
 */
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useParams, useSearch } from "@tanstack/react-router";
import { Download } from "lucide-react";
import { useCallback, useMemo } from "react";
import { qk } from "@/api/keys";
import { getJob } from "@/api/pipeline";
import { pollingOptions } from "@/api/polling";
import type { JobDetail } from "@/api/types/jobs";
import { Button } from "@/components/Button";
import type { TableControlsPatch } from "@/components/DataTable";
import { FilterBar } from "@/components/FilterBar";
import { FilterSelect } from "@/components/FilterSelect";
import { SearchInput } from "@/components/SearchInput";
import { jobExportUrl } from "@/lib/csv";
import { cleanSearch } from "@/lib/url";
import { SignalDrawer } from "./SignalDrawer";
import { SignalsTable, SignalsTableTools } from "./SignalsTable";
import { FLAGS_SENTENCE } from "./explorerText";
import type { JobSignalsSearch } from "./searchSchema";
import {
  HQ_SCOPE_OPTIONS,
  INDUSTRY_OPTIONS,
  MATERIALITY_OPTIONS,
  ORG_KIND_OPTIONS,
  REVENUE_BIN_OPTIONS,
  SIGNAL_OPTIONS,
} from "./signalCatalog";
import { countCompanies, filterJobSignalRows } from "./signalFilters";
import { useJobSignals } from "./useSignalsQueries";
import { useSignalsTableControls } from "./useSignalsTable";

const ROUTE_ID = "/_app/jobs/$jobId/signals" as const;
const ROUTE_PATH = "/jobs/$jobId/signals" as const;

export function JobSignalsTab() {
  const { jobId } = useParams({ from: ROUTE_ID });
  const search = useSearch({ from: ROUTE_ID });
  const navigate = useNavigate({ from: ROUTE_PATH });

  const patch = useCallback(
    (changes: Partial<JobSignalsSearch>, options: { replace?: boolean } = {}) =>
      void navigate({
        search: (previous: JobSignalsSearch) =>
          cleanSearch({ ...previous, ...changes }) as JobSignalsSearch,
        replace: options.replace ?? false,
      }),
    [navigate],
  );
  const patchFilters = useCallback(
    (changes: Partial<JobSignalsSearch>) =>
      patch({ ...changes, after: undefined, detail: undefined }),
    [patch],
  );
  const onControlsChange = useCallback(
    (controls: TableControlsPatch) => patch({ ...controls }, { replace: true }),
    [patch],
  );

  const job = useQuery<JobDetail>({
    queryKey: qk.v1.jobs.detail(jobId),
    queryFn: () => getJob(jobId),
    ...pollingOptions("calm"),
  });
  const serverFilters = useMemo(
    () => ({
      signal: search.signal,
      materiality: search.materiality,
      org_kind: search.org_kind,
      hq_scope: search.hq_scope,
    }),
    [search.hq_scope, search.materiality, search.org_kind, search.signal],
  );
  const page = useJobSignals(jobId, serverFilters, {
    after: search.after,
    onAfterChange: (after) => patch({ after, detail: undefined }),
  });
  const rows = useMemo(
    () =>
      filterJobSignalRows(page.items, {
        industry: search.industry,
        revenue_bin: search.revenue_bin,
        q: search.q,
      }),
    [page.items, search.industry, search.q, search.revenue_bin],
  );
  const table = useSignalsTableControls({
    route: "job",
    density: search.density,
    cols: search.cols,
    onChange: onControlsChange,
  });

  const anyFilter = Boolean(
    search.signal ||
    search.materiality ||
    search.org_kind ||
    search.hq_scope ||
    search.industry ||
    search.revenue_bin ||
    search.q,
  );
  const total = anyFilter ? null : (job.data?.progress.signals ?? null);
  const from = page.footer.showing?.from ?? 1;
  const industry = typeof job.data?.input.industry === "string" ? job.data.input.industry : null;

  return (
    <section aria-labelledby="job-tab-signals-title" className="flex flex-col gap-4">
      <h2 id="job-tab-signals-title" className="sr-only">
        Signals
      </h2>
      <FilterBar>
        <SearchInput
          label="Search company, signal or evidence"
          value={search.q}
          onValueChange={(q) => patchFilters({ q })}
          width={250}
        />
        <FilterSelect
          label="Signal"
          value={search.signal}
          onValueChange={(signal) => patchFilters({ signal })}
          options={SIGNAL_OPTIONS}
          width={130}
        />
        <FilterSelect
          label="Materiality"
          value={search.materiality}
          onValueChange={(materiality) => patchFilters({ materiality })}
          options={MATERIALITY_OPTIONS}
          width={130}
        />
        <FilterSelect
          label="Org kind"
          value={search.org_kind}
          onValueChange={(org_kind) => patchFilters({ org_kind })}
          options={ORG_KIND_OPTIONS}
          width={120}
        />
        <FilterSelect
          label="HQ scope"
          value={search.hq_scope}
          onValueChange={(hq_scope) => patchFilters({ hq_scope })}
          options={HQ_SCOPE_OPTIONS}
          width={120}
        />
        <FilterSelect
          label="Industry"
          value={search.industry}
          onValueChange={(industry) => patchFilters({ industry })}
          options={INDUSTRY_OPTIONS}
          width={120}
        />
        <FilterSelect
          label="Revenue"
          value={search.revenue_bin}
          onValueChange={(revenue_bin) => patchFilters({ revenue_bin })}
          options={REVENUE_BIN_OPTIONS}
          width={120}
        />
        <div className="ml-auto flex items-center gap-2">
          <SignalsTableTools table={table} />
          <Button asChild variant="secondary" size="sm">
            <a href={jobExportUrl(jobId, "signals")} download="signals.csv">
              <Download aria-hidden />
              signals.csv
            </a>
          </Button>
        </div>
      </FilterBar>
      <SignalsTable
        rows={rows}
        table={table}
        ariaLabel="Signals of this job"
        isLoading={page.query.isPending}
        error={page.query.error}
        onRetry={() => void page.query.refetch()}
        emptyTitle={anyFilter ? "No signals match these filters" : "No signals yet"}
        emptyDescription={
          anyFilter
            ? "Clear a filter or search for another company."
            : "Signals appear here as the analysis stage classifies the accepted articles."
        }
        pagination={{
          ...page.footer,
          showing: rows.length ? { from, to: from + rows.length - 1, total } : null,
          noun: "signal",
          note: `${countCompanies(rows)} companies · ${FLAGS_SENTENCE}`,
        }}
      />
      <SignalDrawer
        rows={rows}
        detailId={search.detail}
        loading={page.query.isPending}
        job={{
          id: jobId,
          county: job.data?.county,
          stateCode: job.data?.state_code,
          industry,
        }}
      />
    </section>
  );
}
