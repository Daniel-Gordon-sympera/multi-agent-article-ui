/**
 * One keyset page of a per-job sub-resource (`GET /v1/jobs/{id}/<resource>`), cursor bound to
 * the tab's `after` search param when the caller passes `onAfterChange`. Operations resources
 * poll `live` while the job runs, results resources `calm`.
 */
import { useQuery } from "@tanstack/react-query";
import { qk, type JobSubResource } from "@/api/keys";
import { useKeysetPage, type KeysetPageResult } from "@/api/pagination";
import { listJobTasks } from "@/api/pipeline";
import { pollingOptions, type PollKind } from "@/api/polling";
import type { Page, PageParams } from "@/api/types/common";
import type { Task } from "@/api/types/tasks";
import { isTerminalJobStatus } from "@/lib/status";

export interface JobResourcePageOptions<Row, Filters> {
  jobId: string;
  resource: JobSubResource;
  filters: Filters;
  fetchPage: (jobId: string, filters: Filters, page: PageParams) => Promise<Page<Row>>;
  /** The job status decides whether `live` polling is on (non-terminal only). */
  jobStatus?: string;
  kind?: "operations" | "results";
  after?: string;
  onAfterChange?: (after: string | undefined) => void;
  limit?: number;
  enabled?: boolean;
}

export function useJobResourcePage<Row, Filters extends object>(
  options: JobResourcePageOptions<Row, Filters>,
): KeysetPageResult<Row> {
  const { jobId, resource, filters, fetchPage, jobStatus, kind = "results" } = options;
  const live = kind === "operations" && !isTerminalJobStatus(jobStatus);
  const polling: PollKind = live ? "live" : "calm";
  return useKeysetPage<Row>(
    qk.v1.jobs.sub(jobId, resource, filters as Record<string, unknown>),
    (page) => fetchPage(jobId, filters, page),
    {
      after: options.after,
      onAfterChange: options.onAfterChange,
      limit: options.limit ?? 50,
      polling,
      enabled: options.enabled ?? true,
    },
  );
}

/** Every task of a job in one list (≤ 1000; the tree and the status chips need them all). */
export function useAllJobTasks(jobId: string, jobStatus: string | undefined, filters: object = {}) {
  const live = !isTerminalJobStatus(jobStatus);
  return useQuery({
    queryKey: qk.v1.jobs.sub(jobId, "tasks", { ...filters, all: true }),
    queryFn: async () => {
      const rows: Task[] = [];
      let after: string | null = null;
      for (let page = 0; page < 5; page += 1) {
        const result: Page<Task> = await listJobTasks(jobId, filters, { limit: 1000, after });
        rows.push(...result.items);
        after = result.next_cursor;
        if (!after) break;
      }
      return rows;
    },
    ...pollingOptions(live ? "live" : "calm"),
  });
}
