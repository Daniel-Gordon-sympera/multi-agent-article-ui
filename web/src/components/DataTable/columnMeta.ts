/**
 * Column metadata understood by `DataTable` (TanStack Table `meta` augmentation): alignment,
 * numeric formatting, widths, mono text and whether the column can be hidden.
 */
import "@tanstack/react-table";

declare module "@tanstack/react-table" {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData, TValue> {
    /** Right-aligned with tabular numerals (counts, money, durations). */
    align?: "left" | "right" | "center";
    /** Human label for the column chooser when the header is not plain text. */
    label?: string;
    /** `false` keeps the column out of the chooser (row actions, the Job column). */
    hideable?: boolean;
    /** Hidden until the user enables it in the chooser. */
    defaultHidden?: boolean;
    width?: number | string;
    minWidth?: number;
    maxWidth?: number;
    mono?: boolean;
    /** Prevents the row link from firing for clicks inside this cell (action columns). */
    interactive?: boolean;
    headerClassName?: string;
    cellClassName?: string;
    /** Marks the actions column (no header text, right aligned, `aria-label`). */
    actions?: boolean;
  }
}

export type RowHeight = 44 | 48 | 52 | 64 | 72;

/** Comfortable → compact heights (mockup §6.5: 48→36 single line, 72→56 two lines). */
export const COMPACT_ROW_HEIGHT: Record<RowHeight, number> = {
  44: 34,
  48: 36,
  52: 40,
  64: 50,
  72: 56,
};
