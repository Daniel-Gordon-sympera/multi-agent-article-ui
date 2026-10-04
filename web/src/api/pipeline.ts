/**
 * Typed functions for every pipeline route the SPA uses, reached through the BFF's `/v1`
 * reverse proxy (engineering contract §1, §4.7). One function per endpoint; mutations are
 * wrapped in `useMutation` hooks inside `features/*`.
 */
import { apiDelete, apiGet, apiPost, fetchJsonWithMeta, fetchPage, withQuery } from "@/api/client";
import type { ArticleDetail, ArticleListFilters, ArticleRow } from "@/api/types/articles";
import type { Page, PageParams } from "@/api/types/common";
import type { CompanyProfile, FlagListFilters, FlagRow } from "@/api/types/companies";
import type { EventListFilters, PipelineEvent } from "@/api/types/events";
import type {
  FinderMemoryFilters,
  FinderMemoryRow,
  FinderSourceFilters,
  FinderSourceRow,
  RankingFilters,
  RankingRow,
} from "@/api/types/finder";
import type {
  CreateJobInput,
  CreatedJob,
  JobCommandResult,
  JobDetail,
  JobListFilters,
  JobRecord,
  JobSummaryResponse,
  LiveJobSummary,
  ResumeJobInput,
  ResumedJob,
  StoredJobSummary,
} from "@/api/types/jobs";
import type { SectionListFilters, SectionRow } from "@/api/types/sections";
import type {
  CompanyListFilters,
  CompanyMentionRow,
  SignalListFilters,
  SignalRow,
} from "@/api/types/signals";
import type { Exploration, SiteRun, SiteRunListFilters, WorkItem } from "@/api/types/siteRuns";
import type {
  ApiKey,
  CreateExportInput,
  CreatedApiKey,
  CreatedExport,
  DailyStats,
  DailyStatsFilters,
  ExportRecord,
  PipelineReadiness,
} from "@/api/types/stats";
import type { SummaryListFilters, SummaryRow } from "@/api/types/summaries";
import type { RetriedTask, Task, TaskListFilters } from "@/api/types/tasks";
import type { Worker, WorkerListFilters } from "@/api/types/workers";

type QueryRecord = Record<string, string | number | boolean | null | undefined>;

const asQuery = (filters: object | undefined): QueryRecord => (filters ?? {}) as QueryRecord;

const job = (id: string) => `/v1/jobs/${encodeURIComponent(id)}`;

/* ------------------------------------------------------------------- jobs */

export function listJobs(
  filters: JobListFilters = {},
  page: PageParams = {},
): Promise<Page<JobRecord>> {
  return fetchPage<JobRecord>("/v1/jobs", page, asQuery(filters));
}

/** `GET /v1/jobs/{id}` — ETag-aware (a `304` is answered from the client cache). */
export function getJob(id: string): Promise<JobDetail> {
  return apiGet<JobDetail>(job(id), { etag: true });
}

/** `202` → live summary while the job runs; `200` → the stored summary afterwards. */
export async function getJobSummary(id: string): Promise<JobSummaryResponse> {
  const result = await fetchJsonWithMeta<LiveJobSummary | StoredJobSummary>(`${job(id)}/summary`, {
    etag: true,
  });
  if (result.status === 202) return { kind: "live", summary: result.data as LiveJobSummary };
  return { kind: "stored", summary: result.data as StoredJobSummary };
}

export function createJob(input: CreateJobInput): Promise<CreatedJob> {
  return apiPost<CreatedJob>("/v1/jobs", input);
}

export function cancelJob(id: string): Promise<JobCommandResult> {
  return apiPost<JobCommandResult>(`${job(id)}/cancel`);
}

export function resumeJob(id: string, input: ResumeJobInput = {}): Promise<ResumedJob> {
  return apiPost<ResumedJob>(`${job(id)}/resume`, input);
}

export function listJobSiteRuns(
  id: string,
  filters: SiteRunListFilters = {},
  page: PageParams = {},
) {
  return fetchPage<SiteRun>(`${job(id)}/site-runs`, page, asQuery(filters));
}

export function listJobTasks(id: string, filters: TaskListFilters = {}, page: PageParams = {}) {
  return fetchPage<Task>(`${job(id)}/tasks`, page, asQuery(filters));
}

export function listJobEvents(id: string, filters: EventListFilters = {}, page: PageParams = {}) {
  return fetchPage<PipelineEvent>(`${job(id)}/events`, page, asQuery(filters));
}

export function listJobSignals(id: string, filters: SignalListFilters = {}, page: PageParams = {}) {
  return fetchPage<SignalRow>(`${job(id)}/signals`, page, asQuery(filters));
}

export function listJobCompanies(
  id: string,
  filters: CompanyListFilters = {},
  page: PageParams = {},
) {
  return fetchPage<CompanyMentionRow>(`${job(id)}/companies`, page, asQuery(filters));
}

export function listJobFlags(id: string, filters: FlagListFilters = {}, page: PageParams = {}) {
  return fetchPage<FlagRow>(`${job(id)}/flags`, page, asQuery(filters));
}

export function listJobSummaries(
  id: string,
  filters: SummaryListFilters = {},
  page: PageParams = {},
) {
  return fetchPage<SummaryRow>(`${job(id)}/summaries`, page, asQuery(filters));
}

export function listJobArticles(
  id: string,
  filters: ArticleListFilters = {},
  page: PageParams = {},
) {
  return fetchPage<ArticleRow>(`${job(id)}/articles`, page, asQuery(filters));
}

export function listJobSections(
  id: string,
  filters: SectionListFilters = {},
  page: PageParams = {},
) {
  return fetchPage<SectionRow>(`${job(id)}/sections`, page, asQuery(filters));
}

export function listJobSources(
  id: string,
  filters: FinderSourceFilters = {},
  page: PageParams = {},
) {
  return fetchPage<FinderSourceRow>(`${job(id)}/sources`, page, asQuery(filters));
}

export function listJobRanking(id: string, filters: RankingFilters = {}, page: PageParams = {}) {
  return fetchPage<RankingRow>(`${job(id)}/ranking`, page, asQuery(filters));
}

/* ------------------------------------------------------------------ tasks */

/** Only `dead` tasks can be retried (`409` otherwise). */
export function retryTask(taskId: number | string): Promise<RetriedTask> {
  return apiPost<RetriedTask>(`/v1/tasks/${encodeURIComponent(String(taskId))}/retry`);
}

/* -------------------------------------------------------------- site runs */

export function getSiteRunExploration(siteRunId: string): Promise<Exploration> {
  return apiGet<Exploration>(`/v1/site-runs/${encodeURIComponent(siteRunId)}/exploration`);
}

export function listSiteRunWork(
  siteRunId: string,
  filters: { stage?: string; outcome?: string; created_after?: string } = {},
  page: PageParams = {},
) {
  return fetchPage<WorkItem>(
    `/v1/site-runs/${encodeURIComponent(siteRunId)}/work`,
    page,
    asQuery(filters),
  );
}

/* ------------------------------------------------------------ companies */

export function getCompany(
  companyKey: string,
  params: {
    state?: string;
    limit?: number;
    after?: string;
    signals_after?: string;
    articles_after?: string;
  } = {},
): Promise<CompanyProfile> {
  return apiGet<CompanyProfile>(
    withQuery(`/v1/companies/${encodeURIComponent(companyKey)}`, params),
  );
}

/* -------------------------------------------------------------- articles */

export function getArticle(articleId: number | string): Promise<ArticleDetail> {
  return apiGet<ArticleDetail>(`/v1/articles/${encodeURIComponent(String(articleId))}`);
}

/** Streams the saved text (`410` when expired) — opened in a new tab, not fetched as JSON. */
export function articleTextUrl(articleId: number | string): string {
  return `/v1/articles/${encodeURIComponent(String(articleId))}?include=text`;
}

export function listArticleSummaries(
  articleId: number | string,
  filters: { prompt_version?: string; include?: "record" } = {},
  page: PageParams = {},
) {
  return fetchPage<SummaryRow>(
    `/v1/articles/${encodeURIComponent(String(articleId))}/summaries`,
    page,
    asQuery(filters),
  );
}

export function artifactUrl(kind: "text" | "transcript" | "export", sha: string): string {
  return `/v1/artifacts/${kind}/${encodeURIComponent(sha)}`;
}

/* --------------------------------------------------------------- finder */

export function listFinderMemory(filters: FinderMemoryFilters = {}, page: PageParams = {}) {
  return fetchPage<FinderMemoryRow>("/v1/finder/memory", page, asQuery(filters));
}

/* --------------------------------------------------------------- workers */

export function listWorkers(filters: WorkerListFilters = {}, page: PageParams = { limit: 200 }) {
  return fetchPage<Worker>("/v1/workers", page, asQuery(filters));
}

/* ----------------------------------------------------------------- stats */

export function listDailyStats(filters: DailyStatsFilters = {}, page: PageParams = { limit: 90 }) {
  return fetchPage<DailyStats>("/v1/stats/daily", page, asQuery(filters));
}

export function getPipelineReadiness(): Promise<PipelineReadiness> {
  return apiGet<PipelineReadiness>("/readyz");
}

/* --------------------------------------------------------------- exports */

export function createExport(input: CreateExportInput): Promise<CreatedExport> {
  return apiPost<CreatedExport>("/v1/exports", input);
}

export function getExport(exportId: string): Promise<ExportRecord> {
  return apiGet<ExportRecord>(`/v1/exports/${encodeURIComponent(exportId)}`);
}

/* -------------------------------------------------------------- api keys */

/** Needs capability `api_keys_list` (B4). */
export function listApiKeys(): Promise<Page<ApiKey>> {
  return fetchPage<ApiKey>("/v1/api-keys");
}

export function createApiKey(input: {
  name: string;
  role: "operator" | "reader";
}): Promise<CreatedApiKey> {
  return apiPost<CreatedApiKey>("/v1/api-keys", input);
}

export function deleteApiKey(name: string): Promise<void> {
  return apiDelete<void>(`/v1/api-keys/${encodeURIComponent(name)}`);
}
