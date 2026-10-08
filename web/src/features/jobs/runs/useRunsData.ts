/**
 * Data of the Runs table: one keyset page of `GET /v1/jobs` (or a Scout's runs from
 * `GET /app/scouts/{id}/jobs`), server-side filters, progress snapshots and the
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
import type { JobsSearch } from "@/features/jobs/searchSchemas";
import { useBatchMembership } from "@/features/jobs/useJobQueries";
import { isTerminalJobStatus } from "@/lib/status";
import { createdBounds } from "./createdFilter";

export const RUNS_PAGE_SIZE = 50;

/** Filters and ordering are applied before backend pagination. */
export function apiFiltersFor(search: JobsSearch): JobListFilters {
  const bounds = createdBounds(search.created, {
    after: search.created_after,
    before: search.created_before,
  });
  return {
    status: search.status && search.status !== "running" ? search.status : undefined,
    state: search.state,
    county: search.county,
    industry: search.industry,
    q: search.q,
    status_group: search.status === "running" ? "running" : undefined,
    order: "created_desc",
    ...bounds,
  };
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
  const apiFilters = useMemo(() => apiFiltersFor(search), [search]);
  const scoutId = search.scout;

  const scout = useQuery({
    queryKey: qk.app.scout(scoutId ?? ""),
    queryFn: () => getScout(scoutId ?? ""),
    enabled: Boolean(scoutId),
    ...pollingOptions("static"),
  });

  // Live polling while any loaded run is still working; calm once the page is all terminal.
  const page = useKeysetPage<JobRecord>(
    scoutId ? [...qk.app.scoutJobs(scoutId), apiFilters] : qk.v1.jobs.list({ ...apiFilters }),
    (params) =>
      scoutId ? listScoutJobs(scoutId, params, apiFilters) : listJobs(apiFilters, params),
    {
      after: search.after,
      onAfterChange,
      limit: RUNS_PAGE_SIZE,
      polling: pollingForRows,
    },
  );
  const anyLive = page.items.some((job) => !isTerminalJobStatus(job.status));

  const rows = page.items;
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
  };
}
