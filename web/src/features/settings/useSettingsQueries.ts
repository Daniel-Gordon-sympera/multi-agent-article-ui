/**
 * Settings queries: `/app/system*` (static · no polling, refetched by the page's Refresh),
 * `/v1/workers` (live), the daily stats (keyset "Load more" through `useInfiniteQuery`).
 */
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { getDeadByCategory, getMaintenanceSchedule, getQueueSummary, getSystem } from "@/api/bff";
import { qk } from "@/api/keys";
import { listDailyStats, listWorkers } from "@/api/pipeline";
import { pollingOptions } from "@/api/polling";

export const DEAD_BY_CATEGORY_DAYS = 7;
export const DAILY_STATS_PAGE_SIZE = 30;

export function useSystemInfo() {
  return useQuery({
    queryKey: qk.app.system(),
    queryFn: getSystem,
    ...pollingOptions("calm"),
  });
}

export function useQueueSummary() {
  return useQuery({
    queryKey: qk.app.systemQueue(),
    queryFn: getQueueSummary,
    ...pollingOptions("live"),
  });
}

export function useDeadByCategory(days = DEAD_BY_CATEGORY_DAYS) {
  return useQuery({
    queryKey: qk.app.deadByCategory(days),
    queryFn: () => getDeadByCategory(days),
    ...pollingOptions("calm"),
  });
}

export function useMaintenanceSchedule() {
  return useQuery({
    queryKey: qk.app.maintenance(),
    queryFn: getMaintenanceSchedule,
    ...pollingOptions("static"),
  });
}

export function useWorkers() {
  return useQuery({
    queryKey: qk.v1.workers(),
    queryFn: async () => (await listWorkers()).items,
    ...pollingOptions("live"),
  });
}

/** Newest day first; `fetchNextPage` sends the API's `next_cursor` as `after`. */
export function useDailyStatsPages(pageSize = DAILY_STATS_PAGE_SIZE) {
  return useInfiniteQuery({
    queryKey: [...qk.v1.statsDaily(), "pages", pageSize],
    queryFn: ({ pageParam }) => listDailyStats({}, { limit: pageSize, after: pageParam }),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.next_cursor,
    staleTime: pollingOptions("calm").staleTime,
  });
}
