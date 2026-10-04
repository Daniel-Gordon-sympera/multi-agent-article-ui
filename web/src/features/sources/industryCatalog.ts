/** The NAICS industry labels of `data/industries.json` (the catalog the pipeline uses). */
import industriesCatalog from "@/data/industries.json";

export interface IndustryCatalogEntry {
  label: string;
  code: string;
}

export const INDUSTRY_CATALOG: readonly IndustryCatalogEntry[] = (
  industriesCatalog as { industries: IndustryCatalogEntry[] }
).industries;

export const INDUSTRY_LABELS: readonly string[] = INDUSTRY_CATALOG.map((entry) => entry.label);

/** Catalog spelling when the typed text matches a label (case-insensitive); else the trimmed text. */
export function canonicalIndustry(text: string): string {
  const trimmed = text.trim().replace(/\s+/g, " ");
  const match = INDUSTRY_CATALOG.find(
    (entry) => entry.label.toLowerCase() === trimmed.toLowerCase(),
  );
  return match ? match.label : trimmed;
}
