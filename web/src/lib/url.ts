/**
 * Search-param helpers shared by the routes (`validateSearch` schemas) and by the
 * FilterBar/DataTable hooks that read and write filters, density, columns and cursors.
 */
import { z } from "zod";

/**
 * A string param that is dropped when empty and never throws on bad input. The router parses
 * `?q=123` into a number, so numeric and boolean values are stringified instead of rejected.
 */
export const optionalString = z
  .union([z.string(), z.number(), z.boolean()])
  .transform((v) => {
    const text = String(v).trim();
    return text === "" ? undefined : text;
  })
  .optional()
  .catch(undefined);

/** An enum param that silently resets to `undefined` on unknown values. */
export function optionalEnum<const T extends readonly [string, ...string[]]>(values: T) {
  return z.enum(values).optional().catch(undefined);
}

export const densitySchema = optionalEnum(["comfortable", "compact"]);
export type DensityParam = z.infer<typeof densitySchema>;

/** Comma-separated list ⇄ array; `?cols=job,status` → ["job", "status"]. */
export const listParam = z
  .union([z.string(), z.array(z.string())])
  .transform((v) => {
    const parts = Array.isArray(v) ? v : v.split(",");
    const cleaned = parts.map((p) => p.trim()).filter(Boolean);
    return cleaned.length ? cleaned : undefined;
  })
  .optional()
  .catch(undefined);

export const positiveIntParam = z.coerce.number().int().positive().optional().catch(undefined);

/** The URL-bound table state every list route carries (contract §5.1). */
export const tableSearchSchema = z.object({
  density: densitySchema,
  cols: listParam,
  after: optionalString,
});
export type TableSearch = z.infer<typeof tableSearchSchema>;

/** Removes `undefined`, `null` and empty strings so URLs stay short. */
export function cleanSearch<T extends Record<string, unknown>>(search: T): Partial<T> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(search)) {
    if (value === undefined || value === null || value === "") continue;
    if (Array.isArray(value) && value.length === 0) continue;
    out[key] = value;
  }
  return out as Partial<T>;
}

/** Applies a patch to the current search; `undefined` in the patch removes the key. */
export function patchSearch<T extends Record<string, unknown>>(
  current: T,
  patch: Partial<T>,
): Partial<T> {
  return cleanSearch({ ...current, ...patch });
}

export function joinList(values: readonly string[] | undefined): string | undefined {
  return values && values.length ? values.join(",") : undefined;
}

export function splitList(value: string | undefined | null): string[] {
  return (value ?? "")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

/** Builds a query string from a record, skipping empty values. */
export function toQueryString(
  params: Record<string, string | number | boolean | undefined | null>,
): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    search.set(key, String(value));
  }
  const text = search.toString();
  return text ? `?${text}` : "";
}

/** True when the URL points at another origin (used to add rel/target to external links). */
export function isExternalUrl(url: string): boolean {
  return /^https?:\/\//i.test(url);
}

/** "https://www.orlandomagazine.com/x" → "orlandomagazine.com". */
export function domainOf(url: string | null | undefined): string {
  if (!url) return "";
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return (
      url
        .replace(/^https?:\/\//, "")
        .replace(/^www\./, "")
        .split("/")[0] ?? ""
    );
  }
}
