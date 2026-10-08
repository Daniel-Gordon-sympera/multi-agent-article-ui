/**
 * SignalsTable — the shared signals DataTable (mockup §3.6 / §3.8): rows 72 px (56 compact),
 * dense 10×10 cell padding, `minWidth` 1000, the one column registry with the route's default
 * visibility, URL-bound density and columns (`useSignalsTableControls`), and a row click that
 * opens the drawer (`?detail=`). `SignalsTableTools` renders the density and column buttons.
 */
import type { ReactNode } from "react";
import {
  ColumnChooser,
  DataTable,
  DensityToggle,
  type DataTablePagination,
} from "@/components/DataTable";
import { signalRowKey, type SignalTableRow } from "./signalColumns";
import { useOpenSignalDetail, type SignalsTableControls } from "./useSignalsTable";

export interface SignalsTableProps {
  rows: SignalTableRow[] | undefined;
  table: SignalsTableControls;
  ariaLabel: string;
  isLoading?: boolean;
  error?: unknown;
  onRetry?: () => void;
  pagination?: DataTablePagination;
  emptyTitle?: ReactNode;
  emptyDescription?: ReactNode;
  footerSlot?: ReactNode;
}

/** The toolbar's density toggle and column chooser for a signals table. */
export function SignalsTableTools({ table }: { table: SignalsTableControls }) {
  return (
    <>
      <DensityToggle {...table.controls.densityToggleProps} />
      <ColumnChooser {...table.controls.columnChooserProps} />
    </>
  );
}

export function SignalsTable({
  rows,
  table,
  ariaLabel,
  isLoading,
  error,
  onRetry,
  pagination,
  emptyTitle = "No signals match",
  emptyDescription,
  footerSlot,
}: SignalsTableProps) {
  const open = useOpenSignalDetail();
  return (
    <DataTable<SignalTableRow>
      columns={table.columns}
      data={rows}
      ariaLabel={ariaLabel}
      getRowId={signalRowKey}
      rowHeight={72}
      cellPadding="dense"
      minWidth={1000}
      density={table.controls.tableProps.density}
      columnVisibility={table.controls.tableProps.columnVisibility}
      onRowClick={(row) => open(row)}
      isLoading={isLoading}
      error={error}
      onRetry={onRetry}
      emptyTitle={emptyTitle}
      emptyDescription={emptyDescription}
      pagination={pagination}
      footerSlot={footerSlot}
    />
  );
}
