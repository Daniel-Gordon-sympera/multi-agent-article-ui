/** Saved-view ⇄ URL search conversions of the explorer (contract §4.3 `View.search`). */
import type { View } from "@/api/types/bff";
import type { SignalsSearch } from "./searchSchema";
import { toCrossJobFilters } from "./signalExport";

export const SIGNALS_ROUTE = "/signals";

export type ExplorerSearch = Record<string, unknown>;

/** The search a saved view restores: its filters, its columns, the current density, the view id. */
export function searchForView(view: View, current: Pick<SignalsSearch, "density">): ExplorerSearch {
  const filters = toCrossJobFilters(view.search);
  return {
    ...filters,
    cols: view.columns && view.columns.length ? view.columns : undefined,
    density: current.density,
    view: view.id,
  };
}

/** What `POST /app/views` stores for the current explorer state. */
export function viewInputFor(
  search: SignalsSearch,
  input: { name: string; shared: boolean },
): {
  name: string;
  route: string;
  search: Record<string, unknown>;
  columns: string[] | null;
  shared: boolean;
} {
  return {
    name: input.name,
    route: SIGNALS_ROUTE,
    search: { ...toCrossJobFilters(search) },
    columns: search.cols ?? null,
    shared: input.shared,
  };
}
