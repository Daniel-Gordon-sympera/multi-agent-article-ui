/**
 * Job detail queries shared by the layout and every tab: the job (live polling until terminal,
 * ETag-aware), its summary (202 live / 200 stored) and batch membership from `/app/batches`.
 */
import { useQuery } from "@tanstack/react-query";
import { lookupBatches } from "@/api/bff";
import { qk } from "@/api/keys";
import { getJob, getJobSummary } from "@/api/pipeline";
import { pollingOptions } from "@/api/polling";
import type { JobDetail } from "@/api/types/jobs";
import { isTerminalJobStatus } from "@/lib/status";

export function useJobDetail(jobId: string, options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: qk.v1.jobs.detail(jobId),
    queryFn: () => getJob(jobId),
    enabled: options.enabled ?? true,
    refetchInterval: (query) => {
      const data = query.state.data as JobDetail | undefined;
      return data && isTerminalJobStatus(data.status)
        ? false
        : pollingOptions("live").refetchInterval;
    },
    refetchIntervalInBackground: false,
    staleTime: pollingOptions("live").staleTime,
  });
}

export function useJobSummary(
  jobId: string,
  status: string | undefined,
  options: { enabled?: boolean } = {},
) {
  const terminal = isTerminalJobStatus(status);
  return useQuery({
    queryKey: qk.v1.jobs.summary(jobId),
    queryFn: () => getJobSummary(jobId),
    enabled: options.enabled ?? true,
    ...pollingOptions("live", !terminal),
  });
}

export function useBatchMembership(jobIds: readonly string[]) {
  const ids = [...jobIds].filter(Boolean).sort();
  return useQuery({
    queryKey: qk.app.batches(ids),
    queryFn: () => lookupBatches(ids),
    enabled: ids.length > 0,
    ...pollingOptions("static"),
  });
}
