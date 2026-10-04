/** Pure helpers of Settings › Stats & costs: 14-day series, totals and the CSV columns. */
import type { DailyStats } from "@/api/types/stats";
import type { CsvColumn } from "@/lib/csv";

export const SERIES_DAYS = 14;

/** The `days` most recent rows, oldest first (rows arrive newest first). */
export function recentSeries(rows: readonly DailyStats[], pick: (r: DailyStats) => number) {
  return [...rows]
    .sort((a, b) => a.day.localeCompare(b.day))
    .slice(-SERIES_DAYS)
    .map(pick);
}

export function sumOf(rows: readonly DailyStats[], pick: (r: DailyStats) => number): number {
  return rows.reduce((total, row) => total + pick(row), 0);
}

export const dayCost = (row: DailyStats): number => row.cost_usd ?? row.known_cost_usd;

export function failuresCount(row: DailyStats): number {
  return Object.values(row.failures ?? {}).reduce((sum, n) => sum + n, 0);
}

export function failuresText(row: DailyStats): string {
  return Object.entries(row.failures ?? {})
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([category, count]) => `${category}: ${count}`)
    .join("; ");
}

export const DAILY_STATS_CSV_COLUMNS: CsvColumn<DailyStats>[] = [
  { header: "day", value: (r) => r.day },
  { header: "jobs", value: (r) => r.jobs },
  { header: "site_runs", value: (r) => r.site_runs },
  { header: "articles", value: (r) => r.articles },
  { header: "companies", value: (r) => r.companies },
  { header: "signals", value: (r) => r.signals },
  { header: "input_tokens", value: (r) => r.input_tokens },
  { header: "output_tokens", value: (r) => r.output_tokens },
  { header: "cost_usd", value: (r) => r.cost_usd },
  { header: "known_cost_usd", value: (r) => r.known_cost_usd },
  { header: "unpriced_calls", value: (r) => r.unpriced_calls },
  { header: "unknown_usage_calls", value: (r) => r.unknown_usage_calls },
  { header: "cost_complete", value: (r) => r.cost_complete },
  { header: "failures", value: (r) => failuresText(r) },
];
