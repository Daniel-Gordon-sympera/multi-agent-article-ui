/**
 * Data of the Runs table: one keyset page of `GET /v1/jobs` (or a Scout's runs from
 * `GET /app/scouts/{id}/jobs`), the client-side filters the API lacks (search, "Running",
 * industry without capability B3), the progress snapshots of `GET /app/jobs/progress` and the
 * batch memberships for the chips. Polls `live` while any row is still running.
 */
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { getJobsProgress, getScout, listScoutJobs } from "@/api/bff";
import { qk } from "@/api/keys";
import { useKeysetPage } from "@/api/pagination";
import { listJobs } from "@/api/pipeline";
import { pollingOptions } from "@/api/polling";
import type { JobListFilters, JobRecord } from "@/api/types/jobs";
import { useSession } from "@/app/providers/SessionProvider";
import { jobIndustry, jobTarget } from "@/features/jobs/jobTitle";
import type { JobsSearch } from "@/features/jobs/searchSchemas";
import { matchesQuery } from "@/features/jobs/shared/tableSearch";
import { useBatchMembership } from "@/features/jobs/useJobQueries";
import { shortId } from "@/lib/format";
import { isRunningJobStatus, isTerminalJobStatus } from "@/lib/status";
import { createdBounds } from "./createdFilter";

export const RUNS_PAGE_SIZE = 50;

/** The API's exact-match filters; "running" and (without B3) industry stay client-side. */
export function apiFiltersFor(search: JobsSearch, industryFilterOnApi: boolean): JobListFilters {
  const bounds = createdBounds(search.created, {
    after: search.created_after,
    before: search.created_before,
  });
  return {
    status: search.status && search.status !== "running" ? search.status : undefined,
    state: search.state,
    county: search.county,
    industry: industryFilterOnApi ? search.industry : undefined,
    ...bounds,
  };
}

/** What the API could not filter: free text, the synthetic "Running" status, industry (no B3). */
export function clientFilter(
  rows: JobRecord[],
  search: JobsSearch,
  industryFilterOnApi: boolean,
): JobRecord[] {
  return rows.filter((job) => {
    if (search.status === "running" && !isRunningJobStatus(job.status)) return false;
    if (!industryFilterOnApi && search.industry) {
      if ((jobIndustry(job) ?? "").toLowerCase() !== search.industry.toLowerCase()) return false;
    }
    return matchesQuery(search.q, [
      job.county,
      job.state_code,
      jobTarget(job),
      job.id,
      shortId(job.id),
      job.client_reference,
      typeof job.input.url === "string" ? job.input.url : null,
      ...(Array.isArray(job.input.seeds) ? job.input.seeds.map((s) => s.url) : []),
    ]);
  });
}

/** `live` while any loaded run is still working, `calm` once the page is all terminal. */
export function pollingForRows(rows: readonly JobRecord[]): "live" | "calm" {
  return rows.some((job) => !isTerminalJobStatus(job.status)) ? "live" : "calm";
}

export function useJobsProgress(jobIds: readonly string[], live: boolean) {
  const ids = useMemo(() => [...new Set(jobIds)].sort(), [jobIds]);
  return useQuery({
    queryKey: qk.app.jobsProgress(ids),
    queryFn: () => getJobsProgress(ids),
    enabled: ids.length > 0,
    placeholderData: (previous) => previous,
    ...pollingOptions(live ? "live" : "calm"),
  });
}

export function useRunsData(
  search: JobsSearch,
  onAfterChange: (after: string | undefined) => void,
) {
  const { hasCapability } = useSession();
  const industryOnApi = hasCapability("jobs_industry_filter");
  const apiFilters = useMemo(() => apiFiltersFor(search, industryOnApi), [search, industryOnApi]);
  const scoutId = search.scout;

  const scout = useQuery({
    queryKey: qk.app.scout(scoutId ?? ""),
    queryFn: () => getScout(scoutId ?? ""),
    enabled: Boolean(scoutId),
    ...pollingOptions("static"),
  });

  // Live polling while any loaded run is still working; calm once the page is all terminal.
  const page = useKeysetPage<JobRecord>(
    scoutId ? qk.app.scoutJobs(scoutId) : qk.v1.jobs.list({ ...apiFilters }),
    (params) => (scoutId ? listScoutJobs(scoutId, params) : listJobs(apiFilters, params)),
    {
      after: search.after,
      onAfterChange,
      limit: RUNS_PAGE_SIZE,
      polling: pollingForRows,
    },
  );
  const anyLive = page.items.some((job) => !isTerminalJobStatus(job.status));

  const rows = useMemo(
    () => clientFilter(page.items, search, industryOnApi),
    [industryOnApi, page.items, search],
  );
  const ids = useMemo(() => rows.map((job) => job.id), [rows]);
  const progress = useJobsProgress(ids, anyLive);
  const batches = useBatchMembership(ids);

  return {
    page,
    rows,
    allRows: page.items,
    progress: progress.data ?? {},
    batches: batches.data?.batches ?? {},
    scout: scout.data ?? null,
    scoutError: scout.error,
    industryOnApi,
  };
}
