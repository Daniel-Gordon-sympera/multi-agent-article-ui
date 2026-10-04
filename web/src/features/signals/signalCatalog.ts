/**
 * Static vocabularies of the signal screens: the signal catalog (`data/signals.json`, keys ⇄
 * titles), the job industries (`data/industries.json`) and the fixed option lists of the
 * enrichment flags (materiality, org kind, HQ scope, revenue bins).
 */
import industriesCatalog from "@/data/industries.json";
import signalsCatalog from "@/data/signals.json";
import type { FilterOption } from "@/components/FilterSelect";

export interface SignalCatalogEntry {
  key: string;
  title: string;
  summary: string;
  priority: string;
  groups: string[];
}

export const SIGNAL_CATALOG: readonly SignalCatalogEntry[] = (
  signalsCatalog as { signals: SignalCatalogEntry[] }
).signals;

const TITLE_BY_KEY = new Map(SIGNAL_CATALOG.map((entry) => [entry.key, entry.title]));
const KEY_BY_TITLE = new Map(SIGNAL_CATALOG.map((entry) => [entry.title.toLowerCase(), entry.key]));

/** The catalog title of a signal key; unknown keys read as themselves with `_` → spaces. */
export function signalTitle(key: string | null | undefined): string {
  if (!key) return "—";
  return TITLE_BY_KEY.get(key) ?? key.replace(/_/g, " ");
}

/** The catalog key for a title (fixtures store titles; the API filters by key). */
export function signalKeyForTitle(title: string): string | undefined {
  return KEY_BY_TITLE.get(title.trim().toLowerCase());
}

/** Options for a "Signal" filter: value = catalog key, label = title. */
export const SIGNAL_OPTIONS: FilterOption[] = [...SIGNAL_CATALOG]
  .sort((a, b) => a.title.localeCompare(b.title))
  .map((entry) => ({ value: entry.key, label: entry.title }));

export const INDUSTRY_OPTIONS: FilterOption[] = (
  industriesCatalog as { industries: Array<{ label: string }> }
).industries.map((industry) => ({ value: industry.label, label: industry.label }));

export const MATERIALITY_OPTIONS: FilterOption[] = ["High", "Medium", "Low"].map((value) => ({
  value,
  label: value,
}));

export const ORG_KIND_OPTIONS: FilterOption[] = ["business", "gov", "nonprofit", "unknown"].map(
  (value) => ({ value, label: value }),
);

export const HQ_SCOPE_OPTIONS: FilterOption[] = ["local", "state", "national", "unknown"].map(
  (value) => ({ value, label: value }),
);

/** The enrichment revenue bins (mockup §3.6) plus the two non-values the flags can carry. */
export const REVENUE_BIN_OPTIONS: FilterOption[] = [
  "<$1M",
  "$1M-$10M",
  "$10M-$20M",
  "$20M-$50M",
  "$50M-$100M",
  "$100M-$500M",
  ">$500M",
  "unknown",
  "NA",
].map((value) => ({ value, label: value }));
