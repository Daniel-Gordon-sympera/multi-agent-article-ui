/**
 * 14 days of `GET /v1/stats/daily` rows (contract §1 shape). Signals follow the mockup's
 * sparkline (rising towards today); the failures of the last 7 days add up to the "Dead tasks
 * by category" card of mockup §4.7 (model_rate_limited 3 · saved_content_unavailable 2 ·
 * task_timeout 1 · network_error 1), with one new dead task today.
 */
import type { DailyStats } from "@/api/types/stats";
import { dateDaysAgo } from "./clock";

/** Deterministic pseudo-random in [0, 1) from a seed (no Math.random so snapshots stay stable). */
function noise(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

/** Signals per day, oldest first (14 days). */
export const SIGNAL_SHAPE = [7, 9, 8, 11, 10, 14, 12, 16, 11, 15, 19, 22, 24, 18];

/** Failures by "days ago" (0 = today). */
const FAILURES_BY_AGE: Record<number, Record<string, number>> = {
  0: { model_rate_limited: 1 },
  1: { saved_content_unavailable: 1 },
  2: { model_rate_limited: 1, task_timeout: 1 },
  4: { saved_content_unavailable: 1, network_error: 1 },
  5: { model_rate_limited: 1 },
  8: { model_rate_limited: 2 },
  11: { network_error: 1 },
};

export function buildDailyStatsFixtures(days = 14): DailyStats[] {
  const rows: DailyStats[] = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const n = noise(i + 1);
    const signals = SIGNAL_SHAPE[days - 1 - i] ?? 12;
    const articles = Math.round(signals * 2.4 + n * 6);
    const inputTokens = Math.round(articles * 23_000 + n * 50_000);
    const outputTokens = Math.round(inputTokens * 0.19);
    const cost = Number(((inputTokens / 1e6) * 1.1 + (outputTokens / 1e6) * 4.4).toFixed(2));
    const incomplete = i === 9;
    rows.push({
      day: dateDaysAgo(i),
      jobs: 2 + Math.round(n * 3),
      site_runs: 8 + Math.round(n * 10),
      articles,
      companies: Math.round(articles * 3.2),
      signals,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      cost_usd: incomplete ? null : cost,
      known_cost_usd: incomplete ? Number((cost * 0.8).toFixed(2)) : cost,
      unpriced_calls: incomplete ? 3 : 0,
      unknown_usage_calls: 0,
      cost_complete: !incomplete,
      failures: FAILURES_BY_AGE[i] ?? {},
    });
  }
  return rows;
}
