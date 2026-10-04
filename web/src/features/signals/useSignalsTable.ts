/**
 * Hooks of the shared signals table: the route's columns with URL-bound density and column
 * controls, and the navigation that opens the drawer (`?detail=<id>`).
 */
import { useNavigate } from "@tanstack/react-router";
import { useCallback, useMemo } from "react";
import type { DensityPreference } from "@/api/types/bff";
import { useDataTableControls, type TableControlsPatch } from "@/components/DataTable";
import { buildSignalColumns } from "./signalCells";
import { detailParam, type SignalTableRow, type SignalsTableRoute } from "./signalColumns";

export interface UseSignalsTableControlsOptions {
  route: SignalsTableRoute;
  density?: DensityPreference;
  cols?: string[];
  onChange: (patch: TableControlsPatch) => void;
}

/** Columns for the route plus the density/column controls bound to the caller's URL state. */
export function useSignalsTableControls({
  route,
  density,
  cols,
  onChange,
}: UseSignalsTableControlsOptions) {
  const columns = useMemo(() => buildSignalColumns(route), [route]);
  const controls = useDataTableControls<SignalTableRow>({ columns, density, cols, onChange });
  return { route, columns, controls };
}

export type SignalsTableControls = ReturnType<typeof useSignalsTableControls>;

type AnySearch = Record<string, unknown>;

/** Navigates to the current route with `?detail=<id>` (push, so Back closes the drawer). */
export function useOpenSignalDetail() {
  const navigate = useNavigate();
  return useCallback(
    (row: Pick<SignalTableRow, "id">) =>
      void navigate({
        to: ".",
        search: (previous: AnySearch) => ({ ...previous, detail: detailParam(row.id) }),
      } as never),
    [navigate],
  );
}
