/**
 * `patchFilters` / `patchTable` for a route: both write the search params in place (`replace`),
 * filters additionally drop the keyset cursor. Pass `Route.useNavigate()`.
 */
import { useCallback, useMemo } from "react";
import { filterUpdater, searchUpdater } from "./tableSearch";

type NavigateLike<S> = (options: { search: (previous: S) => S; replace: true }) => unknown;

export function useTabHandlers<S extends Record<string, unknown>>(navigate: NavigateLike<S>) {
  const patchFilters = useCallback(
    (patch: Partial<S>) => void navigate({ search: filterUpdater<S>(patch), replace: true }),
    [navigate],
  );
  const patchTable = useCallback(
    (patch: Partial<S>) => void navigate({ search: searchUpdater<S>(patch), replace: true }),
    [navigate],
  );
  return useMemo(() => ({ patchFilters, patchTable }), [patchFilters, patchTable]);
}
