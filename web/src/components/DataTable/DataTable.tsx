/**
 * DataTable — contract §5.5 / mockup §5: TanStack Table v8 inside a card (border, radius 12,
 * shadow, horizontal scroll box, `minWidth`), header row h40 uppercase 12/600 on surface-2,
 * rows 44–72 px (compact via density), right-aligned tabular numeric cells, row hover, optional
 * client sort, row link, loading skeleton rows, empty and error states, pagination footer.
 * Column visibility and density come from `useDataTableControls` (URL-bound) or props.
 */
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type Row,
  type SortingState,
  type VisibilityState,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { useState, type CSSProperties, type MouseEvent, type ReactNode } from "react";
import type { DensityPreference } from "@/api/types/bff";
import { EmptyState } from "@/components/EmptyState";
import { ErrorState } from "@/components/ErrorState";
import { Skeleton } from "@/components/Skeleton";
import { cn } from "@/lib/cn";
import { COMPACT_ROW_HEIGHT, type RowHeight } from "./columnMeta";
import { DataTableFooter, type DataTablePagination } from "./DataTableFooter";

export interface DataTableProps<TRow> {
  columns: ColumnDef<TRow, unknown>[];
  data: TRow[] | undefined;
  /** Required accessible name, e.g. "Runs", "Signals of this job". */
  ariaLabel: string;
  getRowId?: (row: TRow, index: number) => string;
  rowHeight?: RowHeight;
  minWidth?: number;
  /** Vertical scroll box; the header sticks to its top. */
  maxHeight?: number | string;
  density?: DensityPreference;
  columnVisibility?: VisibilityState;
  onColumnVisibilityChange?: (state: VisibilityState) => void;
  enableSorting?: boolean;
  sorting?: SortingState;
  onSortingChange?: (state: SortingState) => void;
  /** Called for clicks on the row outside interactive elements; rows get a pointer cursor. */
  onRowClick?: (row: TRow, event: MouseEvent<HTMLTableRowElement>) => void;
  rowClassName?: (row: TRow) => string | undefined;
  isLoading?: boolean;
  skeletonRows?: number;
  error?: unknown;
  onRetry?: () => void;
  emptyState?: ReactNode;
  emptyTitle?: ReactNode;
  emptyDescription?: ReactNode;
  pagination?: DataTablePagination;
  /** Content below the rows and above the footer (e.g. a NoteBanner). */
  footerSlot?: ReactNode;
  className?: string;
  /** Padding preset: `default` 10×12 (20 at the edges), `dense` 10×10 for signal tables. */
  cellPadding?: "default" | "dense";
}

const INTERACTIVE_SELECTOR =
  "a, button, input, select, textarea, label, [role='button'], [role='menuitem'], [data-interactive]";

function alignClass(align: "left" | "right" | "center" | undefined): string {
  if (align === "right") return "text-right tabular";
  if (align === "center") return "text-center";
  return "text-left";
}

export function DataTable<TRow>({
  columns,
  data,
  ariaLabel,
  getRowId,
  rowHeight = 48,
  minWidth,
  maxHeight,
  density,
  columnVisibility,
  onColumnVisibilityChange,
  enableSorting = false,
  sorting,
  onSortingChange,
  onRowClick,
  rowClassName,
  isLoading = false,
  skeletonRows = 6,
  error,
  onRetry,
  emptyState,
  emptyTitle = "Nothing here yet",
  emptyDescription,
  pagination,
  footerSlot,
  className,
  cellPadding = "default",
}: DataTableProps<TRow>) {
  const [internalSorting, setInternalSorting] = useState<SortingState>([]);
  const [internalVisibility, setInternalVisibility] = useState<VisibilityState>({});
  const rows = data ?? [];

  const table = useReactTable<TRow>({
    data: rows,
    columns,
    getRowId,
    state: {
      sorting: sorting ?? internalSorting,
      columnVisibility: columnVisibility ?? internalVisibility,
    },
    onSortingChange: (updater) => {
      const next = typeof updater === "function" ? updater(sorting ?? internalSorting) : updater;
      if (onSortingChange) onSortingChange(next);
      else setInternalSorting(next);
    },
    onColumnVisibilityChange: (updater) => {
      const next =
        typeof updater === "function" ? updater(columnVisibility ?? internalVisibility) : updater;
      if (onColumnVisibilityChange) onColumnVisibilityChange(next);
      else setInternalVisibility(next);
    },
    enableSorting,
    manualSorting: !enableSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: enableSorting ? getSortedRowModel() : undefined,
  });

  const visibleColumns = table.getVisibleLeafColumns();
  const columnCount = Math.max(1, visibleColumns.length);
  const compactHeight = COMPACT_ROW_HEIGHT[rowHeight];
  const style = {
    "--table-row-comfortable": `${rowHeight}px`,
    "--table-row-compact": `${compactHeight}px`,
  } as CSSProperties;
  const edgePad =
    cellPadding === "dense" ? "px-2.5 first:pl-5 last:pr-5" : "px-3 first:pl-5 last:pr-5";
  const showBody = !isLoading && !error && rows.length > 0;

  const handleRowClick = (row: Row<TRow>) => (event: MouseEvent<HTMLTableRowElement>) => {
    if (!onRowClick) return;
    const target = event.target as HTMLElement;
    if (target.closest(INTERACTIVE_SELECTOR)) return;
    const cell = target.closest("td");
    if (cell?.dataset.interactive === "true") return;
    onRowClick(row.original, event);
  };

  return (
    <div
      className={cn("data-table card flex flex-col overflow-hidden p-0", className)}
      data-density={density}
      style={style}
    >
      <div
        className={cn("overflow-x-auto", maxHeight !== undefined && "overflow-y-auto")}
        style={{ maxHeight }}
      >
        <table
          aria-label={ariaLabel}
          aria-busy={isLoading || undefined}
          className="w-full border-separate border-spacing-0 text-[13px] text-ink"
          style={{ minWidth }}
        >
          <thead className="sticky top-0 z-10">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const meta = header.column.columnDef.meta;
                  const sortable = enableSorting && header.column.getCanSort();
                  const sorted = header.column.getIsSorted();
                  const label = flexRender(header.column.columnDef.header, header.getContext());
                  return (
                    <th
                      key={header.id}
                      scope="col"
                      aria-sort={
                        sorted === "asc"
                          ? "ascending"
                          : sorted === "desc"
                            ? "descending"
                            : undefined
                      }
                      className={cn(
                        "h-10 border-b border-border bg-surface-2 py-0 text-table-head whitespace-nowrap text-muted",
                        edgePad,
                        alignClass(meta?.align),
                        meta?.headerClassName,
                      )}
                      style={{
                        width: meta?.width,
                        minWidth: meta?.minWidth,
                        maxWidth: meta?.maxWidth,
                      }}
                    >
                      {header.isPlaceholder ? null : sortable ? (
                        <button
                          type="button"
                          onClick={header.column.getToggleSortingHandler()}
                          className={cn(
                            "inline-flex items-center gap-1 rounded-tag text-table-head text-muted hover:text-ink",
                            meta?.align === "right" && "flex-row-reverse",
                          )}
                        >
                          {label}
                          {sorted === "asc" ? (
                            <ArrowUp size={12} aria-hidden />
                          ) : sorted === "desc" ? (
                            <ArrowDown size={12} aria-hidden />
                          ) : (
                            <ArrowUpDown size={12} className="opacity-50" aria-hidden />
                          )}
                        </button>
                      ) : meta?.actions ? (
                        <span className="sr-only">
                          {typeof label === "string" && label ? label : "Actions"}
                        </span>
                      ) : (
                        label
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {isLoading
              ? Array.from({ length: skeletonRows }, (_, rowIndex) => (
                  <tr
                    key={`skeleton-${rowIndex}`}
                    className="data-table-row border-b border-border"
                    aria-hidden
                  >
                    {visibleColumns.map((column, columnIndex) => (
                      <td
                        key={column.id}
                        className={cn("border-b border-border py-[var(--cell-py)]", edgePad)}
                      >
                        <Skeleton
                          className={cn(
                            "h-3.5",
                            columnIndex === 0 ? "w-3/4" : "w-1/2",
                            column.columnDef.meta?.align === "right" && "ml-auto",
                          )}
                        />
                      </td>
                    ))}
                  </tr>
                ))
              : null}
            {!isLoading && error ? (
              <tr>
                <td colSpan={columnCount} className="p-0">
                  <ErrorState variant="plain" error={error} onRetry={onRetry} />
                </td>
              </tr>
            ) : null}
            {!isLoading && !error && rows.length === 0 ? (
              <tr>
                <td colSpan={columnCount} className="p-0">
                  {emptyState ?? (
                    <EmptyState variant="plain" title={emptyTitle} description={emptyDescription} />
                  )}
                </td>
              </tr>
            ) : null}
            {showBody
              ? table.getRowModel().rows.map((row) => (
                  <tr
                    key={row.id}
                    className={cn(
                      "data-table-row group/row hover:bg-surface-2",
                      onRowClick && "cursor-pointer",
                      rowClassName?.(row.original),
                    )}
                    onClick={onRowClick ? handleRowClick(row) : undefined}
                  >
                    {row.getVisibleCells().map((cell) => {
                      const meta = cell.column.columnDef.meta;
                      return (
                        <td
                          key={cell.id}
                          data-interactive={meta?.interactive || meta?.actions ? "true" : undefined}
                          className={cn(
                            "border-b border-border py-[var(--cell-py)] align-middle group-last/row:border-b-0",
                            edgePad,
                            alignClass(meta?.align),
                            meta?.mono && "font-mono text-[12px]",
                            meta?.cellClassName,
                          )}
                          style={{
                            width: meta?.width,
                            minWidth: meta?.minWidth,
                            maxWidth: meta?.maxWidth,
                          }}
                        >
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      );
                    })}
                  </tr>
                ))
              : null}
          </tbody>
        </table>
      </div>
      {footerSlot}
      {pagination ? (
        <DataTableFooter {...pagination} loading={isLoading} className="border-t border-border" />
      ) : null}
    </div>
  );
}
