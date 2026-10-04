/**
 * Pure helpers of the Data Sources screen (mockup §3.10): origin sub-line, precision wording,
 * day-relative labels, filter options, the CSV export columns and the import template.
 */
import type { Source, SourcePrecision, Suggestion } from "@/api/types/bff";
import { downloadText, rowsToCsv, type CsvColumn } from "@/lib/csv";
import { formatInteger, formatPercent, formatShortDate, parseDate } from "@/lib/format";

export const CSV_TEMPLATE =
  "name,url,county,state,industries\r\n" +
  "Orlando Magazine,https://orlandomagazine.com,Orange,FL,Construction;Manufacturing\r\n" +
  "Range Wire,https://rangewire.com,Jefferson,CO,Construction\r\n";

export const CSV_TEMPLATE_HREF = `data:text/csv;charset=utf-8,${encodeURIComponent(CSV_TEMPLATE)}`;

export const MAX_IMPORT_BYTES = 1_048_576;

/** "today" · "yesterday" · "Oct 2" — the day of an instant relative to now (UTC days). */
export function relativeDayLabel(value: string | null | undefined, now = new Date()): string {
  const date = parseDate(value);
  if (!date) return "—";
  const day = (d: Date) => Math.floor(d.getTime() / 86_400_000);
  const diff = day(now) - day(date);
  if (diff === 0) return "today";
  if (diff === 1) return "yesterday";
  return formatShortDate(date);
}

/** "Promoted Sep 30 · rank 1" · "Added Sep 28 · rank 5" · "Imported Sep 20". */
export function originLine(source: Pick<Source, "origin" | "created_at" | "finder">): string {
  const verb =
    source.origin === "finder" ? "Promoted" : source.origin === "csv" ? "Imported" : "Added";
  const when = formatShortDate(source.created_at);
  const rank = source.finder?.rank;
  return rank ? `${verb} ${when} · rank ${rank}` : `${verb} ${when}`;
}

export function originLabel(origin: Source["origin"]): string {
  return origin;
}

/** "18 / 142 candidates". */
export function precisionCounts(precision: SourcePrecision): string {
  return `${formatInteger(precision.accepted)} / ${formatInteger(precision.candidates)} candidates`;
}

export function precisionPercent(precision: SourcePrecision | null): string {
  return precision?.ratio === null || precision?.ratio === undefined
    ? "—"
    : formatPercent(precision.ratio);
}

/** "Orange County" — the county line of the Location column. */
export function countyLabel(county: string): string {
  const text = county.trim();
  return /county$/i.test(text) ? text : `${text} County`;
}

export function tierLabel(tier: string | null | undefined): string | null {
  if (tier === null || tier === undefined || tier === "") return null;
  const text = String(tier);
  if (/^\d+$/.test(text)) return `Tier ${text}`;
  const named: Record<string, string> = { high: "Tier 1", medium: "Tier 2", low: "Tier 3" };
  return named[text.toLowerCase()] ?? `Tier ${text}`;
}

export function suggestionLocation(
  suggestion: Pick<Suggestion, "county" | "state_code" | "industry">,
): string {
  const base = `${countyLabel(suggestion.county)}, ${suggestion.state_code.toUpperCase()}`;
  return suggestion.industry ? `${base} · ${suggestion.industry}` : base;
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

export function sourceStateOptions(sources: readonly Source[]): string[] {
  return unique(sources.map((s) => s.state_code.toUpperCase()));
}

export function sourceCountyOptions(sources: readonly Source[], state?: string): string[] {
  return unique(
    sources
      .filter((s) => !state || s.state_code.toUpperCase() === state.toUpperCase())
      .map((s) => s.county.replace(/\s+county$/i, "")),
  );
}

export function sourceIndustryOptions(sources: readonly Source[]): string[] {
  return unique(sources.flatMap((s) => s.industries));
}

/** Promoted finder sources created in the last 7 days — the "+N this week" delta. */
export function promotedThisWeek(sources: readonly Source[], now = new Date()): number {
  const cutoff = now.getTime() - 7 * 86_400_000;
  return sources.filter((s) => {
    const created = parseDate(s.created_at);
    return (
      s.origin === "finder" && s.status === "active" && !!created && created.getTime() >= cutoff
    );
  }).length;
}

export const SOURCE_CSV_COLUMNS: readonly CsvColumn<Source>[] = [
  { header: "name", value: (s) => s.name },
  { header: "url", value: (s) => s.url },
  { header: "domain", value: (s) => s.domain },
  { header: "county", value: (s) => s.county },
  { header: "state", value: (s) => s.state_code },
  { header: "industries", value: (s) => s.industries.join(";") },
  { header: "origin", value: (s) => s.origin },
  { header: "status", value: (s) => s.status },
  { header: "finder_tier", value: (s) => s.finder?.tier ?? "" },
  { header: "finder_rank", value: (s) => s.finder?.rank ?? "" },
  { header: "finder_reason", value: (s) => s.finder?.reason ?? "" },
  { header: "precision_accepted", value: (s) => s.precision?.accepted ?? "" },
  { header: "precision_candidates", value: (s) => s.precision?.candidates ?? "" },
  { header: "precision_job_id", value: (s) => s.precision?.job_id ?? "" },
  { header: "created_at", value: (s) => s.created_at },
  { header: "removed_at", value: (s) => s.removed_at ?? "" },
];

export function exportSourcesCsv(rows: readonly Source[]): void {
  const stamp = new Date().toISOString().slice(0, 10);
  downloadText(`sources-${stamp}.csv`, rowsToCsv(rows, SOURCE_CSV_COLUMNS));
}
