/**
 * Queries of the signal screens: the cross-job page (`/app/signals`, calm polling), its summary,
 * a job's signals page, and the drawer's detail reads (company profile with the 409 state
 * fallback, article summaries, the summary record).
 */
import { useQuery } from "@tanstack/react-query";
import { getCrossJobSignalsSummary, listCrossJobSignals } from "@/api/bff";
import { isApiError } from "@/api/client";
import { qk } from "@/api/keys";
import { useKeysetPage } from "@/api/pagination";
import { getCompany, listArticleSummaries, listJobSignals } from "@/api/pipeline";
import { pollingOptions } from "@/api/polling";
import type { CrossJobSignalFilters } from "@/api/types/bff";
import type { CompanyProfile } from "@/api/types/companies";
import type { CrossJobSignalRow, SignalListFilters, SignalRow } from "@/api/types/signals";

export interface PageCursorOptions {
  after?: string;
  onAfterChange?: (after: string | undefined) => void;
  limit?: number;
}

/** One page from the global signal query. */
export function useCrossJobSignals(filters: CrossJobSignalFilters, cursor: PageCursorOptions) {
  return useKeysetPage<CrossJobSignalRow>(
    qk.app.signals({ ...filters }),
    (params) => listCrossJobSignals(filters, params),
    {
      polling: "calm",
      after: cursor.after,
      onAfterChange: cursor.onAfterChange,
      limit: cursor.limit,
    },
  );
}

export function useCrossJobSignalsSummary(filters: CrossJobSignalFilters) {
  return useQuery({
    queryKey: [...qk.app.signals({ ...filters }), "summary"],
    queryFn: () => getCrossJobSignalsSummary(filters),
    ...pollingOptions("calm"),
  });
}

export function useJobSignals(
  jobId: string,
  filters: SignalListFilters,
  cursor: PageCursorOptions,
) {
  return useKeysetPage<SignalRow>(
    qk.v1.jobs.sub(jobId, "signals", { ...filters }),
    (params) => listJobSignals(jobId, filters, params),
    {
      polling: "calm",
      after: cursor.after,
      onAfterChange: cursor.onAfterChange,
      limit: cursor.limit,
    },
  );
}

/** `409 company_state_required` → the candidate states to ask for. */
export function companyStatesFromError(error: unknown): string[] | null {
  if (!isApiError(error) || error.status !== 409) return null;
  const states = (error.problem as { states?: unknown } | null)?.states;
  return Array.isArray(states) ? states.filter((s): s is string => typeof s === "string") : [];
}

export function useCompanyProfile(
  companyKey: string | undefined,
  state: string | undefined,
  jobId?: string,
) {
  return useQuery<CompanyProfile>({
    queryKey: qk.v1.companies.detail(companyKey ?? "", state, jobId),
    queryFn: () => getCompany(companyKey ?? "", { state, job_id: jobId }),
    enabled: Boolean(companyKey),
    retry: false,
    ...pollingOptions("static"),
  });
}

export function useArticleSummaries(articleId: number | undefined) {
  return useQuery({
    queryKey: qk.v1.articles.summaries(articleId ?? 0),
    queryFn: () => listArticleSummaries(articleId ?? 0),
    enabled: articleId !== undefined,
    ...pollingOptions("static"),
  });
}

export function useArticleSummaryRecord(articleId: number | undefined, enabled: boolean) {
  return useQuery({
    queryKey: qk.v1.articles.summaries(articleId ?? 0, { include: "record" }),
    queryFn: () => listArticleSummaries(articleId ?? 0, { include: "record" }),
    enabled: enabled && articleId !== undefined,
    ...pollingOptions("static"),
  });
}
