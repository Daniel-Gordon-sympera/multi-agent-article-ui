/**
 * Toolbar controls shared by every table: the density toggle (`rows-2`, "Toggle density") and
 * the column chooser popover (`columns-2`, "Choose columns"), both 32×32 icon buttons as in the
 * mockup toolbars, plus `useDataTableControls` which binds them (and the table) to the URL
 * search params `density` and `cols`.
 */
import type { ColumnDef, VisibilityState } from "@tanstack/react-table";
import { Columns2, Rows2 } from "lucide-react";
import { useCallback, useMemo } from "react";
import type { DensityPreference } from "@/api/types/bff";
import { useTheme } from "@/app/providers/ThemeProvider";
import { Button } from "@/components/Button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { SimpleTooltip } from "@/components/ui/tooltip";

export interface ColumnChoice {
  id: string;
  label: string;
  visible: boolean;
}

export interface TableControlsPatch {
  density?: DensityPreference;
  cols?: string[];
}

export interface UseDataTableControlsOptions<Row> {
  columns: ColumnDef<Row, unknown>[];
  /** Current URL values (undefined = defaults). */
  density?: DensityPreference;
  cols?: string[];
  /** Writes the new values to the URL (`undefined` clears a key). */
  onChange: (patch: TableControlsPatch) => void;
}

function columnId<Row>(column: ColumnDef<Row, unknown>): string | undefined {
  if (column.id) return column.id;
  const accessor = (column as { accessorKey?: unknown }).accessorKey;
  return typeof accessor === "string" ? accessor : undefined;
}

function columnLabel<Row>(column: ColumnDef<Row, unknown>, id: string): string {
  if (column.meta?.label) return column.meta.label;
  return typeof column.header === "string" && column.header ? column.header : id;
}

export function useDataTableControls<Row>({
  columns,
  density,
  cols,
  onChange,
}: UseDataTableControlsOptions<Row>) {
  const theme = useTheme();
  const effectiveDensity: DensityPreference = density ?? theme.density;

  const hideable = useMemo(
    () =>
      columns
        .map((column) => ({ column, id: columnId(column) }))
        .filter(
          (entry): entry is { column: ColumnDef<Row, unknown>; id: string } =>
            entry.id !== undefined,
        )
        .filter(({ column }) => column.meta?.hideable !== false && column.enableHiding !== false),
    [columns],
  );

  const defaultVisible = useMemo(
    () => hideable.filter(({ column }) => !column.meta?.defaultHidden).map(({ id }) => id),
    [hideable],
  );

  const visibleIds = cols ?? defaultVisible;

  const columnVisibility = useMemo<VisibilityState>(() => {
    const state: VisibilityState = {};
    for (const { id } of hideable) state[id] = visibleIds.includes(id);
    return state;
  }, [hideable, visibleIds]);

  const choices = useMemo<ColumnChoice[]>(
    () =>
      hideable.map(({ column, id }) => ({
        id,
        label: columnLabel(column, id),
        visible: visibleIds.includes(id),
      })),
    [hideable, visibleIds],
  );

  const setColumnVisible = useCallback(
    (id: string, visible: boolean) => {
      const next = hideable
        .map(({ id: cid }) => cid)
        .filter((cid) => (cid === id ? visible : visibleIds.includes(cid)));
      const isDefault =
        next.length === defaultVisible.length && next.every((cid) => defaultVisible.includes(cid));
      onChange({ cols: isDefault ? undefined : next });
    },
    [defaultVisible, hideable, onChange, visibleIds],
  );

  const resetColumns = useCallback(() => onChange({ cols: undefined }), [onChange]);

  const toggleDensity = useCallback(() => {
    const next: DensityPreference = effectiveDensity === "compact" ? "comfortable" : "compact";
    onChange({ density: next === theme.density ? undefined : next });
  }, [effectiveDensity, onChange, theme.density]);

  return {
    density: effectiveDensity,
    columnVisibility,
    choices,
    setColumnVisible,
    resetColumns,
    toggleDensity,
    densityToggleProps: { density: effectiveDensity, onToggle: toggleDensity },
    columnChooserProps: { choices, onToggle: setColumnVisible, onReset: resetColumns },
    tableProps: { density: effectiveDensity, columnVisibility },
  };
}

export interface DensityToggleProps {
  density: DensityPreference;
  onToggle: () => void;
}

export function DensityToggle({ density, onToggle }: DensityToggleProps) {
  const compact = density === "compact";
  return (
    <SimpleTooltip content={compact ? "Comfortable rows" : "Compact rows"}>
      <Button
        variant="secondary"
        size="icon-sm"
        aria-label="Toggle density"
        aria-pressed={compact}
        onClick={onToggle}
        data-density={density}
      >
        <Rows2 aria-hidden />
      </Button>
    </SimpleTooltip>
  );
}

export interface ColumnChooserProps {
  choices: ColumnChoice[];
  onToggle: (id: string, visible: boolean) => void;
  onReset?: () => void;
}

export function ColumnChooser({ choices, onToggle, onReset }: ColumnChooserProps) {
  const visibleCount = choices.filter((c) => c.visible).length;
  return (
    <Popover>
      <SimpleTooltip content="Choose columns">
        <PopoverTrigger asChild>
          <Button variant="secondary" size="icon-sm" aria-label="Choose columns">
            <Columns2 aria-hidden />
          </Button>
        </PopoverTrigger>
      </SimpleTooltip>
      <PopoverContent className="w-60 p-2" aria-label="Columns">
        <div className="flex items-center justify-between px-2 py-1.5">
          <span className="text-section-head text-muted">Columns</span>
          {onReset ? (
            <Button variant="link" size="xs" onClick={onReset} className="text-[12px]">
              Reset
            </Button>
          ) : null}
        </div>
        <ul className="flex flex-col">
          {choices.map((choice) => (
            <li key={choice.id}>
              <div className="flex h-8 items-center gap-2.5 rounded-tag px-2 text-[13px] text-ink hover:bg-surface-2">
                <Checkbox
                  id={`column-choice-${choice.id}`}
                  checked={choice.visible}
                  disabled={choice.visible && visibleCount === 1}
                  onCheckedChange={(value) => onToggle(choice.id, value === true)}
                />
                <label htmlFor={`column-choice-${choice.id}`} className="flex-1 cursor-pointer">
                  {choice.label}
                </label>
              </div>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
