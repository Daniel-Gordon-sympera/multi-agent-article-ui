/**
 * Overview queries (plan §6.1): tiles poll `calm`, the active runs, attention and workers
 * poll `live`; the recent signals come from `GET /app/signals?limit=5` (B3's endpoint).
 * `useRefreshOverview` invalidates every query the page shows (the Refresh button).
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getOverview, listActiveRuns, listAttention, listCrossJobSignals } from "@/api/bff";
import { qk } from "@/api/keys";
import { listWorkers } from "@/api/pipeline";
import { pollingOptions } from "@/api/polling";

export const RECENT_SIGNALS_LIMIT = 5;
const RECENT_SIGNALS_FILTERS = { limit: RECENT_SIGNALS_LIMIT } as const;

export function useOverviewSummary() {
  return useQuery({
    queryKey: qk.app.overview(),
    queryFn: getOverview,
    ...pollingOptions("calm"),
  });
}

export function useActiveRuns() {
  return useQuery({
    queryKey: qk.app.activeRuns(),
    queryFn: listActiveRuns,
    ...pollingOptions("live"),
  });
}

export function useAttention() {
  return useQuery({
    queryKey: qk.app.attention(),
    queryFn: listAttention,
    ...pollingOptions("live"),
  });
}

export function useOverviewWorkers() {
  return useQuery({
    queryKey: qk.v1.workers(),
    queryFn: async () => (await listWorkers()).items,
    ...pollingOptions("live"),
  });
}

export function useRecentSignals() {
  return useQuery({
    queryKey: qk.app.signals(RECENT_SIGNALS_FILTERS),
    queryFn: async () => (await listCrossJobSignals({}, { limit: RECENT_SIGNALS_LIMIT })).items,
    ...pollingOptions("calm"),
  });
}

/** Refetches everything on the page at once; `isPending` drives the button spinner. */
export function useRefreshOverview() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: qk.app.overview() }),
        queryClient.invalidateQueries({ queryKey: qk.app.attention() }),
        queryClient.invalidateQueries({ queryKey: qk.v1.workers() }),
        queryClient.invalidateQueries({ queryKey: qk.app.signals(RECENT_SIGNALS_FILTERS) }),
        queryClient.invalidateQueries({ queryKey: ["app", "batches"] }),
      ]),
  });
}
