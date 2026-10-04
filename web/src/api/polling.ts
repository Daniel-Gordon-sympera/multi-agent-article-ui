/**
 * Polling policy (engineering contract §5.2, plan §6.2): `live` for the things an operator
 * watches (jobs list, job header/summary, site runs, tasks, workers), `calm` for results tables
 * and tiles, `static` for settings and saved views. Polling pauses in background tabs.
 */

export const POLL = {
  live: 5_000,
  calm: 30_000,
  static: false,
} as const;

export type PollKind = keyof typeof POLL;

export interface PollingQueryOptions {
  refetchInterval: number | false;
  refetchIntervalInBackground: false;
  staleTime: number;
}

/**
 * Spread into `useQuery` options. `enabled = false` stops the interval (used for terminal jobs)
 * while keeping the data fresh for the usual stale window.
 */
export function pollingOptions(kind: PollKind, enabled = true): PollingQueryOptions {
  const interval = POLL[kind];
  const active = enabled && interval !== false ? interval : false;
  return {
    refetchInterval: active,
    refetchIntervalInBackground: false,
    staleTime: interval === false ? 5 * 60_000 : interval,
  };
}
