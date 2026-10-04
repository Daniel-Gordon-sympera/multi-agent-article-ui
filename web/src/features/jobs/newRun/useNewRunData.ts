/**
 * Queries behind the New run form: the active Data Sources of the chosen county (seed count
 * and the Seeds checkboxes), the cost estimate, the prompt version of the most recent job and
 * the pre-fill sources (`?scout=`, `?from=`, `?source=`).
 */
import { useQuery } from "@tanstack/react-query";
import { getEstimate, getScout, listSources } from "@/api/bff";
import { qk } from "@/api/keys";
import { getJob, listJobs } from "@/api/pipeline";
import { pollingOptions } from "@/api/polling";
import type { Source } from "@/api/types/bff";
import type { JobKind } from "@/api/types/jobs";
import { useDebouncedValue } from "@/lib/hooks/useDebouncedValue";

export function useCountySources(county: string, stateCode: string) {
  const debouncedCounty = useDebouncedValue(county.trim(), 300);
  const state = stateCode.trim().toUpperCase();
  const filters = { county: debouncedCounty, state, status: "active" as const };
  const enabled = debouncedCounty.length > 0 && state.length === 2;
  const query = useQuery({
    queryKey: qk.app.sources(filters),
    queryFn: () => listSources(filters),
    enabled,
    ...pollingOptions("calm"),
  });
  const items: Source[] = enabled ? (query.data?.items ?? []) : [];
  return { sources: items, isLoading: enabled && query.isPending, enabled };
}

export function useCostEstimate(kind: JobKind, sites: number, industry: string | undefined) {
  const params = { kind, sites, industry };
  return useQuery({
    queryKey: qk.app.estimate(params),
    queryFn: () => getEstimate(params),
    ...pollingOptions("calm"),
  });
}

/** The prompt version the API will stamp on new jobs: the most recent job's (or null). */
export function useLatestPromptVersion() {
  return useQuery({
    queryKey: qk.v1.jobs.list({ purpose: "latest-prompt-version" }),
    queryFn: async () => {
      const page = await listJobs({}, { limit: 20 });
      const newest = [...page.items].sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
      return newest?.prompt_version ?? null;
    },
    ...pollingOptions("calm"),
  });
}

export function useScoutForEdit(scoutId: string | undefined) {
  return useQuery({
    queryKey: qk.app.scout(scoutId ?? ""),
    queryFn: () => getScout(scoutId ?? ""),
    enabled: Boolean(scoutId),
    ...pollingOptions("static"),
  });
}

export function useJobForRerun(jobId: string | undefined) {
  return useQuery({
    queryKey: qk.v1.jobs.detail(jobId ?? ""),
    queryFn: () => getJob(jobId ?? ""),
    enabled: Boolean(jobId),
    ...pollingOptions("static"),
  });
}

/** `?source=<id>` — the source row comes from the active list (no single-source endpoint). */
export function useSourceForSeeds(sourceId: string | undefined) {
  return useQuery({
    queryKey: qk.app.sources({ status: "active", purpose: "seed-prefill" }),
    queryFn: async () => (await listSources({ status: "active" })).items,
    enabled: Boolean(sourceId),
    select: (items) => items.find((source) => source.id === sourceId) ?? null,
    ...pollingOptions("static"),
  });
}
