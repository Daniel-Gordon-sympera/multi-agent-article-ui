/**
 * Typed functions for every `/app/*` endpoint of the BFF (engineering contract §4.3–§4.4).
 * One function per endpoint; React Query hooks and mutations live in `features/*`.
 */
import {
  apiDelete,
  apiGet,
  apiPatch,
  apiPost,
  apiPut,
  fetchJson,
  fetchPage,
  withQuery,
} from "@/api/client";
import type {
  AttentionItem,
  Batch,
  BatchInput,
  BatchLookup,
  BffReadiness,
  CapabilitiesResponse,
  ChangePasswordInput,
  CreateUserInput,
  CrossJobSignalFilters,
  CrossJobSignalsPage,
  CrossJobSignalsSummary,
  DismissSuggestionInput,
  Estimate,
  LoginInput,
  Me,
  Prefs,
  PromoteSuggestionInput,
  RetryDeadResult,
  RunScoutInput,
  Scout,
  ScoutInput,
  ScoutWithRuns,
  Source,
  SourceFilters,
  SourceImportResult,
  SourceInput,
  SourcesResponse,
  Suggestion,
  SuggestionFilters,
  SystemInfo,
  UpdateUserInput,
  User,
  View,
  ViewInput,
} from "@/api/types/bff";
import type { JobsProgressMap } from "@/api/types/jobsProgress";
import type { Page, PageParams } from "@/api/types/common";
import type { JobRecord } from "@/api/types/jobs";

type QueryRecord = Record<string, string | number | boolean | null | undefined>;
const asQuery = (filters: object | undefined): QueryRecord => (filters ?? {}) as QueryRecord;

/* ------------------------------------------------------------------- auth */

export function login(input: LoginInput): Promise<Me> {
  return apiPost<Me>("/app/auth/login", input);
}

export function logout(): Promise<void> {
  return apiPost<void>("/app/auth/logout");
}

export function getMe(): Promise<Me> {
  return apiGet<Me>("/app/auth/me");
}

export function changePassword(input: ChangePasswordInput): Promise<void> {
  return apiPost<void>("/app/auth/password", input);
}

/* ------------------------------------------------------------------ users */

export async function listUsers(): Promise<User[]> {
  const result = await apiGet<{ items?: User[] } | User[]>("/app/users");
  return Array.isArray(result) ? result : (result.items ?? []);
}

export function createUser(input: CreateUserInput): Promise<User> {
  return apiPost<User>("/app/users", input);
}

export function updateUser(id: string, input: UpdateUserInput): Promise<User> {
  return apiPatch<User>(`/app/users/${encodeURIComponent(id)}`, input);
}

export function setUserPassword(id: string, newPassword: string): Promise<void> {
  return apiPost<void>(`/app/users/${encodeURIComponent(id)}/password`, {
    new_password: newPassword,
  });
}

/* ----------------------------------------------------------- capabilities */

export function getCapabilities(): Promise<CapabilitiesResponse> {
  return apiGet<CapabilitiesResponse>("/app/capabilities");
}

/* ----------------------------------------------------------------- scouts */

export async function listScouts(): Promise<ScoutWithRuns[]> {
  const result = await apiGet<{ items: ScoutWithRuns[] }>("/app/scouts");
  return result.items ?? [];
}

export function createScout(input: ScoutInput): Promise<Scout> {
  return apiPost<Scout>("/app/scouts", input);
}

export function getScout(id: string): Promise<Scout> {
  return apiGet<Scout>(`/app/scouts/${encodeURIComponent(id)}`);
}

export function updateScout(id: string, input: Partial<ScoutInput>): Promise<Scout> {
  return apiPatch<Scout>(`/app/scouts/${encodeURIComponent(id)}`, input);
}

/** Archives the Scout (`archived_at`); runs stay listed under Runs. */
export function deleteScout(id: string): Promise<void> {
  return apiDelete<void>(`/app/scouts/${encodeURIComponent(id)}`);
}

export function runScout(id: string, input: RunScoutInput = {}): Promise<Batch> {
  return apiPost<Batch>(`/app/scouts/${encodeURIComponent(id)}/run`, input);
}

/** `GET /app/scouts/{id}/jobs` — the runs a Scout launched, newest first (`{items, next_cursor}`). */
export function listScoutJobs(id: string, page: PageParams = {}): Promise<Page<JobRecord>> {
  return fetchPage<JobRecord>(`/app/scouts/${encodeURIComponent(id)}/jobs`, page);
}

/* ---------------------------------------------------------------- batches */

export function createBatch(input: BatchInput): Promise<Batch> {
  return apiPost<Batch>("/app/batches", input);
}

/** `GET /app/batches?job_ids=a,b,c` → memberships keyed by job id. */
export async function lookupBatches(jobIds: readonly string[]): Promise<BatchLookup> {
  if (jobIds.length === 0) return { batches: {} };
  const result = await apiGet<Partial<BatchLookup>>(
    withQuery("/app/batches", { job_ids: jobIds.join(",") }),
  );
  return { batches: result.batches ?? {} };
}

export function getBatch(id: string): Promise<Batch> {
  return apiGet<Batch>(`/app/batches/${encodeURIComponent(id)}`);
}

/* ---------------------------------------------------------------- sources */

export async function listSources(filters: SourceFilters = {}): Promise<SourcesResponse> {
  const result = await apiGet<Partial<SourcesResponse>>(
    withQuery("/app/sources", asQuery(filters)),
  );
  return {
    items: result.items ?? [],
    stats: result.stats ?? {
      active: 0,
      promoted: 0,
      removed: 0,
      counties: 0,
      median_precision: null,
    },
  };
}

export function createSource(input: SourceInput): Promise<Source> {
  return apiPost<Source>("/app/sources", input);
}

export function updateSource(id: string, input: Partial<SourceInput>): Promise<Source> {
  return apiPatch<Source>(`/app/sources/${encodeURIComponent(id)}`, input);
}

/** Soft removal; the row stays for history and can be restored. */
export function removeSource(id: string): Promise<void> {
  return apiDelete<void>(`/app/sources/${encodeURIComponent(id)}`);
}

export function restoreSource(id: string): Promise<Source> {
  return apiPost<Source>(`/app/sources/${encodeURIComponent(id)}/restore`);
}

/** Multipart CSV upload (`name,url,county,state,industries`; max 1 MB / 2,000 rows). */
export function importSources(file: File): Promise<SourceImportResult> {
  const form = new FormData();
  form.append("file", file);
  return fetchJson<SourceImportResult>("/app/sources/import", { method: "POST", body: form });
}

export async function listSuggestions(filters: SuggestionFilters = {}): Promise<Suggestion[]> {
  const result = await apiGet<{ items?: Suggestion[] }>(
    withQuery("/app/sources/suggestions", asQuery(filters)),
  );
  return result.items ?? [];
}

export function promoteSuggestion(input: PromoteSuggestionInput): Promise<Source> {
  return apiPost<Source>("/app/sources/promote", input);
}

export function dismissSuggestion(input: DismissSuggestionInput): Promise<void> {
  return apiPost<void>("/app/sources/dismiss", input);
}

/* ------------------------------------------------------------------ views */

export async function listViews(route?: string): Promise<View[]> {
  const result = await apiGet<{ items?: View[] } | View[]>(withQuery("/app/views", { route }));
  return Array.isArray(result) ? result : (result.items ?? []);
}

export function createView(input: ViewInput): Promise<View> {
  return apiPost<View>("/app/views", input);
}

export function updateView(id: string, input: Partial<ViewInput>): Promise<View> {
  return apiPatch<View>(`/app/views/${encodeURIComponent(id)}`, input);
}

export function deleteView(id: string): Promise<void> {
  return apiDelete<void>(`/app/views/${encodeURIComponent(id)}`);
}

/* ------------------------------------------------------------------ prefs */

export function getPrefs(): Promise<Prefs> {
  return apiGet<Prefs>("/app/prefs");
}

export function updatePrefs(input: Partial<Prefs>): Promise<Prefs> {
  return apiPut<Prefs>("/app/prefs", input);
}

/* -------------------------------------------------------------- attention */

export async function listAttention(): Promise<AttentionItem[]> {
  const result = await apiGet<{ items?: AttentionItem[] }>("/app/attention");
  return result.items ?? [];
}

/* ----------------------------------------------------------------- system */

export function getSystem(): Promise<SystemInfo> {
  return apiGet<SystemInfo>("/app/system");
}

export function getBffReadiness(): Promise<BffReadiness> {
  return apiGet<BffReadiness>("/readyz");
}

/* ---------------------------------------------------------------- signals */

export async function listCrossJobSignals(
  filters: CrossJobSignalFilters = {},
  page: PageParams = {},
): Promise<CrossJobSignalsPage> {
  const result = await apiGet<Partial<CrossJobSignalsPage>>(
    withQuery("/app/signals", {
      ...asQuery(filters),
      limit: page.limit,
      after: page.after ?? undefined,
    }),
  );
  return {
    items: result.items ?? [],
    next_cursor: result.next_cursor ?? null,
    degraded: result.degraded ?? false,
    scanned_jobs: result.scanned_jobs,
    truncated: result.truncated,
  };
}

export async function getCrossJobSignalsSummary(
  filters: CrossJobSignalFilters = {},
): Promise<CrossJobSignalsSummary> {
  const result = await apiGet<Partial<CrossJobSignalsSummary>>(
    withQuery("/app/signals/summary", asQuery(filters)),
  );
  return {
    signals: result.signals ?? 0,
    companies: result.companies ?? 0,
    jobs: result.jobs ?? 0,
    by_materiality: {
      high: result.by_materiality?.high ?? 0,
      medium: result.by_materiality?.medium ?? 0,
      low: result.by_materiality?.low ?? 0,
    },
    top_signal: result.top_signal ?? null,
    degraded: result.degraded,
    scanned_jobs: result.scanned_jobs,
    truncated: result.truncated,
  };
}

export function crossJobSignalsExportUrl(filters: CrossJobSignalFilters = {}): string {
  return withQuery("/app/signals/export.csv", asQuery(filters));
}

/* ------------------------------------------------------------------- jobs */

/** Proxied when capability `retry_dead` exists; else the BFF loops over the dead tasks. */
export function retryDeadTasks(jobId: string): Promise<RetryDeadResult> {
  return apiPost<RetryDeadResult>(`/app/jobs/${encodeURIComponent(jobId)}/retry-dead`);
}

/** `GET /app/jobs/progress?job_ids=a,b,c` (≤ 50 ids) → status, progress, cost and sites per job. */
export async function getJobsProgress(jobIds: readonly string[]): Promise<JobsProgressMap> {
  if (jobIds.length === 0) return {};
  const result = await apiGet<JobsProgressMap | null>(
    withQuery("/app/jobs/progress", { job_ids: jobIds.join(",") }),
  );
  return result ?? {};
}

export function getEstimate(
  params: { kind?: string; sites?: number; industry?: string } = {},
): Promise<Estimate> {
  return apiGet<Estimate>(withQuery("/app/estimate", params));
}
