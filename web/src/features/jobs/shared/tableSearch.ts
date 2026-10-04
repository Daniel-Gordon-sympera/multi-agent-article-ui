/**
 * Search-param updaters for the URL-bound table state (filters, density, columns, cursor —
 * contract §5.1). Used as `navigate({ search: filterUpdater({status: "partial"}), replace: true })`.
 */
import { cleanSearch } from "@/lib/url";

/** Applies `patch` to the current search; `undefined` removes a key. */
export function searchUpdater<S extends Record<string, unknown>>(patch: Partial<S>) {
  return (previous: S): S => cleanSearch({ ...previous, ...patch }) as S;
}

/** A filter change starts again from the first page: the keyset cursor is dropped. */
export function filterUpdater<S extends Record<string, unknown>>(patch: Partial<S>) {
  return searchUpdater<S>({ ...patch, after: undefined } as Partial<S>);
}

/** Distinct, sorted values of one column of the loaded rows (plus the current selection). */
export function optionsFromRows<Row>(
  rows: readonly Row[],
  pick: (row: Row) => string | null | undefined,
  selected?: string,
): string[] {
  const values = new Set<string>();
  for (const row of rows) {
    const value = pick(row);
    if (value) values.add(value);
  }
  if (selected) values.add(selected);
  return [...values].sort((a, b) => a.localeCompare(b));
}

/** Case-insensitive "contains" over several fields for the client-side search boxes. */
export function matchesQuery(query: string | undefined, fields: Array<string | null | undefined>) {
  const needle = (query ?? "").trim().toLowerCase();
  if (!needle) return true;
  return fields.some((field) => (field ?? "").toLowerCase().includes(needle));
}
