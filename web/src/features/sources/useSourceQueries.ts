/** Queries of the Data Sources screen: the filtered list with its stats and the suggestions. */
import { useQuery } from "@tanstack/react-query";
import { listSources, listSuggestions } from "@/api/bff";
import { qk } from "@/api/keys";
import { pollingOptions } from "@/api/polling";
import type { SourceFilters, SuggestionFilters } from "@/api/types/bff";
import type { SourcesSearch } from "./searchSchema";

export const SUGGESTIONS_LIMIT = 50;

/** URL search → `/app/sources` filters (status defaults to `active` on the server too). */
export function sourceFiltersFromSearch(search: SourcesSearch): SourceFilters {
  return {
    county: search.county,
    state: search.state,
    industry: search.industry,
    origin: search.origin,
    status: search.status ?? "active",
    q: search.q,
  };
}

export function useSources(filters: SourceFilters) {
  return useQuery({
    queryKey: qk.app.sources({ ...filters }),
    queryFn: () => listSources(filters),
    ...pollingOptions("calm"),
  });
}

export function useSuggestions(filters: SuggestionFilters = {}) {
  const withLimit = { ...filters, limit: filters.limit ?? SUGGESTIONS_LIMIT };
  return useQuery({
    queryKey: qk.app.suggestions({ ...withLimit }),
    queryFn: () => listSuggestions(withLimit),
    ...pollingOptions("calm"),
  });
}
