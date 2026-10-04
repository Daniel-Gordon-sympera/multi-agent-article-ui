/** The NAICS industry labels of `data/industries.json` (without the code) for the token input. */
import catalog from "@/data/industries.json";

interface CatalogEntry {
  label: string;
  code: string;
}

export const INDUSTRY_LABELS: readonly string[] = (
  catalog as { industries: CatalogEntry[] }
).industries.map((entry) => entry.label);

/** Catalog labels not yet chosen that contain `query` (case-insensitive), at most `limit`. */
export function industrySuggestions(query: string, chosen: readonly string[], limit = 8): string[] {
  const needle = query.trim().toLowerCase();
  return INDUSTRY_LABELS.filter(
    (label) => !chosen.includes(label) && (!needle || label.toLowerCase().includes(needle)),
  ).slice(0, limit);
}
