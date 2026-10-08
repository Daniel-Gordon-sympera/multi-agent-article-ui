/** Wording of the explorer's banner, summary and strip labels (contract §4.4, mockup §3.8). */
import type { CrossJobSignalsSummary } from "@/api/types/bff";
import { datePresetOf } from "./signalFilters";

/** "128 signals · 61 companies · 9 jobs" at the right of the chip row. */
export function summaryText(
  summary: Pick<CrossJobSignalsSummary, "signals" | "companies" | "jobs"> | undefined,
): string {
  if (!summary) return "";
  return `${summary.signals} signals · ${summary.companies} companies · ${summary.jobs} jobs`;
}

/** "Top signal this week: Mass Hiring (19)" — "this week" only with the last-7-days preset. */
export function topSignalLabel(
  summary: CrossJobSignalsSummary | undefined,
  dateAfter?: string,
  dateBefore?: string,
): string {
  const scope =
    datePresetOf(dateAfter, dateBefore) === "7d" ? "Top signal this week" : "Top signal";
  if (!summary?.top_signal) return `${scope}: —`;
  return `${scope}: ${summary.top_signal.title} (${summary.top_signal.count})`;
}

export const FLAGS_SENTENCE =
  "HQ city, state and industry come from the enrichment flags (scope_place, hq_state, company_industry); date is the article's published date";
