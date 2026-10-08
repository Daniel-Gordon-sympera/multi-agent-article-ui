/**
 * Queries of the Scouts tab: the Scouts with their last run (`calm` polling), the active
 * sources (for the "N seeds from Data Sources" column) and the Runs count for the tab badge.
 */
import { useQuery } from "@tanstack/react-query";
import { listScouts, listSources } from "@/api/bff";
import { qk } from "@/api/keys";
import { listJobs } from "@/api/pipeline";
import { pollingOptions } from "@/api/polling";

export const RUNS_COUNT_PAGE = 200;

export function useScouts(options: { archived?: boolean } = {}) {
  return useQuery({
    queryKey: options.archived ? [...qk.app.scouts(), "archived"] : qk.app.scouts(),
    queryFn: () => listScouts(),
    ...pollingOptions("calm"),
  });
}

export function useActiveSources() {
  return useQuery({
    queryKey: qk.app.sources({ status: "active" }),
    queryFn: () => listSources({ status: "active" }),
    ...pollingOptions("calm"),
  });
}

/** Rows of the first `/v1/jobs` page (the API has no totals; hide the badge when more pages exist). */
export function useRunsCount() {
  return useQuery({
    queryKey: qk.v1.jobs.list({ limit: RUNS_COUNT_PAGE }),
    queryFn: () => listJobs({}, { limit: RUNS_COUNT_PAGE }),
    select: (page) => (page.next_cursor ? null : page.items.length),
    ...pollingOptions("calm"),
  });
}
