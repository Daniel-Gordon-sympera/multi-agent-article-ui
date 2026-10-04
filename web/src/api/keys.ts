/**
 * Query-key factories mirroring the API paths (engineering contract §5.2). Every
 * `useQuery`/`invalidateQueries` in the SPA goes through `qk` so related keys share prefixes:
 * `qk.v1.jobs.all` invalidates every job list, detail and sub-list at once.
 */

type Filters = Record<string, unknown> | undefined;

/** Drops empty values so `{status: undefined}` and `{}` produce the same key. */
export function normaliseFilters(filters: Filters): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (!filters) return out;
  for (const key of Object.keys(filters).sort()) {
    const value = filters[key];
    if (value === undefined || value === null || value === "") continue;
    out[key] = value;
  }
  return out;
}

export type JobSubResource =
  | "site-runs"
  | "tasks"
  | "events"
  | "signals"
  | "companies"
  | "flags"
  | "summaries"
  | "articles"
  | "sections"
  | "sources"
  | "ranking";

export const qk = {
  v1: {
    all: ["v1"] as const,
    jobs: {
      all: ["v1", "jobs"] as const,
      list: (filters?: Filters) => ["v1", "jobs", "list", normaliseFilters(filters)] as const,
      detail: (id: string) => ["v1", "jobs", id] as const,
      summary: (id: string) => ["v1", "jobs", id, "summary"] as const,
      sub: (id: string, resource: JobSubResource, filters?: Filters) =>
        ["v1", "jobs", id, resource, normaliseFilters(filters)] as const,
    },
    tasks: {
      detail: (id: number | string) => ["v1", "tasks", String(id)] as const,
    },
    siteRuns: {
      exploration: (id: string) => ["v1", "site-runs", id, "exploration"] as const,
      work: (id: string, filters?: Filters) =>
        ["v1", "site-runs", id, "work", normaliseFilters(filters)] as const,
    },
    companies: {
      detail: (key: string, state?: string) => ["v1", "companies", key, state ?? ""] as const,
    },
    articles: {
      detail: (id: number | string) => ["v1", "articles", String(id)] as const,
      summaries: (id: number | string, filters?: Filters) =>
        ["v1", "articles", String(id), "summaries", normaliseFilters(filters)] as const,
    },
    finderMemory: (filters?: Filters) =>
      ["v1", "finder", "memory", normaliseFilters(filters)] as const,
    urls: (filters?: Filters) => ["v1", "urls", normaliseFilters(filters)] as const,
    workers: (filters?: Filters) => ["v1", "workers", normaliseFilters(filters)] as const,
    statsDaily: (filters?: Filters) => ["v1", "stats", "daily", normaliseFilters(filters)] as const,
    exports: {
      detail: (id: string) => ["v1", "exports", id] as const,
    },
    apiKeys: () => ["v1", "api-keys"] as const,
    readyz: () => ["v1", "readyz"] as const,
  },
  app: {
    all: ["app"] as const,
    me: () => ["app", "auth", "me"] as const,
    capabilities: () => ["app", "capabilities"] as const,
    users: () => ["app", "users"] as const,
    scouts: () => ["app", "scouts"] as const,
    scout: (id: string) => ["app", "scouts", id] as const,
    scoutJobs: (id: string, filters?: Filters) =>
      ["app", "scouts", id, "jobs", normaliseFilters(filters)] as const,
    jobsProgress: (ids: readonly string[]) => ["app", "jobs", "progress", [...ids].sort()] as const,
    batches: (ids: readonly string[]) => ["app", "batches", [...ids].sort()] as const,
    batch: (id: string) => ["app", "batches", "detail", id] as const,
    sources: (filters?: Filters) => ["app", "sources", normaliseFilters(filters)] as const,
    suggestions: (filters?: Filters) =>
      ["app", "sources", "suggestions", normaliseFilters(filters)] as const,
    views: (route?: string) => ["app", "views", route ?? ""] as const,
    prefs: () => ["app", "prefs"] as const,
    attention: () => ["app", "attention"] as const,
    system: () => ["app", "system"] as const,
    signals: (filters?: Filters) => ["app", "signals", normaliseFilters(filters)] as const,
    estimate: (params?: Filters) => ["app", "estimate", normaliseFilters(params)] as const,
    readyz: () => ["app", "readyz"] as const,
  },
} as const;
