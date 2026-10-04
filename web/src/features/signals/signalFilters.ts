/**
 * The explorer's filter vocabulary (contract §4.4 → mockup §3.8 chips): one definition per
 * filter (label, control kind, options), the chip wording of an active filter, date presets
 * ("last 7 days") and the client-side filters the Job › Signals tab applies over its page.
 */
import type { FilterOption } from "@/components/FilterSelect";
import { formatShortDate, shortId } from "@/lib/format";
import {
  HQ_SCOPE_OPTIONS,
  INDUSTRY_OPTIONS,
  MATERIALITY_OPTIONS,
  ORG_KIND_OPTIONS,
  REVENUE_BIN_OPTIONS,
  SIGNAL_OPTIONS,
  signalTitle,
} from "./signalCatalog";
import type { SignalTableRow } from "./signalColumns";
import type { SignalFilterKey, SignalsSearch } from "./searchSchema";

export type FilterControl = "select" | "text" | "date-range";

export interface SignalFilterDefinition {
  key: SignalFilterKey;
  label: string;
  control: FilterControl;
  options?: readonly FilterOption[];
  placeholder?: string;
  /** Short help under the control in the Add-filter popover. */
  hint?: string;
}

export const DATE_RANGE_KEY = "date" as const;

export const FILTER_DEFINITIONS: readonly SignalFilterDefinition[] = [
  {
    key: "state",
    label: "State",
    control: "text",
    placeholder: "FL",
    hint: "Two-letter code of the job's state",
  },
  {
    key: "county",
    label: "County",
    control: "text",
    placeholder: "Orange",
    hint: "The job's county, as created",
  },
  { key: "job_industry", label: "Job industry", control: "select", options: INDUSTRY_OPTIONS },
  { key: "industry", label: "Company industry", control: "select", options: INDUSTRY_OPTIONS },
  { key: "signal", label: "Signal", control: "select", options: SIGNAL_OPTIONS },
  { key: "materiality", label: "Materiality", control: "select", options: MATERIALITY_OPTIONS },
  { key: "revenue_bin", label: "Revenue bin", control: "select", options: REVENUE_BIN_OPTIONS },
  { key: "org_kind", label: "Org kind", control: "select", options: ORG_KIND_OPTIONS },
  { key: "hq_scope", label: "HQ scope", control: "select", options: HQ_SCOPE_OPTIONS },
  { key: "date_after", label: "Date", control: "date-range", hint: "Article publication date" },
  {
    key: "job_id",
    label: "Job id",
    control: "text",
    placeholder: "0192f1c2-…",
    hint: "Full job UUID",
  },
  {
    key: "company_key",
    label: "Company key",
    control: "text",
    placeholder: "lakeview-builders-group",
  },
  { key: "batch_id", label: "Batch id", control: "text", placeholder: "UUID of a Scout run" },
];

/** `YYYY-MM-DD` of `days` days before today (UTC), for the date presets. */
export function isoDateDaysAgo(days: number, now: Date = new Date()): string {
  const d = new Date(now);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

export type DatePreset = "7d" | "30d";

export const DATE_PRESETS: Array<{ value: DatePreset; label: string; days: number }> = [
  { value: "7d", label: "Last 7 days", days: 7 },
  { value: "30d", label: "Last 30 days", days: 30 },
];

export function datePresetOf(
  after: string | undefined,
  before: string | undefined,
  now: Date = new Date(),
): DatePreset | null {
  if (!after || before) return null;
  for (const preset of DATE_PRESETS)
    if (isoDateDaysAgo(preset.days, now) === after) return preset.value;
  return null;
}

export function dateChipLabel(
  after: string | undefined,
  before: string | undefined,
  now: Date = new Date(),
): string {
  const preset = datePresetOf(after, before, now);
  if (preset) return `Date: ${DATE_PRESETS.find((p) => p.value === preset)!.label.toLowerCase()}`;
  if (after && before) return `Date: ${formatShortDate(after)} – ${formatShortDate(before)}`;
  if (after) return `Date: since ${formatShortDate(after)}`;
  return `Date: until ${formatShortDate(before)}`;
}

export interface ActiveChip {
  /** `date` for the combined range, else the filter key. */
  key: SignalFilterKey | typeof DATE_RANGE_KEY;
  label: string;
  /** Search keys to clear when the chip is removed. */
  clears: SignalFilterKey[];
}

/** One chip per active filter, dates merged into one, in the registry order (mockup §3.8). */
export function activeChips(search: SignalsSearch, now: Date = new Date()): ActiveChip[] {
  const chips: ActiveChip[] = [];
  if (search.date_after || search.date_before) {
    chips.push({
      key: DATE_RANGE_KEY,
      label: dateChipLabel(search.date_after, search.date_before, now),
      clears: ["date_after", "date_before"],
    });
  }
  for (const definition of FILTER_DEFINITIONS) {
    if (definition.control === "date-range") continue;
    const value = search[definition.key];
    if (!value) continue;
    chips.push({
      key: definition.key,
      label: `${definition.label}: ${chipValueLabel(definition, value)}`,
      clears: [definition.key],
    });
  }
  return chips;
}

function chipValueLabel(definition: SignalFilterDefinition, value: string): string {
  if (definition.key === "signal") return signalTitle(value);
  if (definition.key === "job_id") return shortId(value);
  if (definition.key === "batch_id") return shortId(value);
  const option = definition.options?.find((o) => o.value === value);
  return option?.label ?? value;
}

/** The job tab filters the API lacks (`industry`, `revenue_bin`) and the free text, over the page. */
export function filterJobSignalRows(
  rows: readonly SignalTableRow[],
  filters: { industry?: string; revenue_bin?: string; q?: string },
): SignalTableRow[] {
  const q = filters.q?.trim().toLowerCase();
  return rows.filter((row) => {
    if (filters.industry && row.company_industry.toLowerCase() !== filters.industry.toLowerCase())
      return false;
    if (filters.revenue_bin && row.revenue_bin.toLowerCase() !== filters.revenue_bin.toLowerCase())
      return false;
    if (q) {
      const haystack = [
        row.company,
        row.name_as_written,
        row.evidence,
        row.signal_evidence ?? "",
        row.signal ?? "",
        row.signal_title ?? "",
        row.source_domain,
      ];
      if (!haystack.some((v) => v.toLowerCase().includes(q))) return false;
    }
    return true;
  });
}

/** Distinct companies on a page — the footer's "· M companies". */
export function countCompanies(rows: readonly Pick<SignalTableRow, "company_key">[]): number {
  return new Set(rows.map((r) => r.company_key)).size;
}
