/**
 * FilterChips — mockup §3.8: active-filter chips (h30, brand-100/700, 12/600, 20 px × button),
 * `[+ Add filter]` xs tonal, "Clear all" ghost and a right-aligned summary text.
 */
import { Plus, X } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/Button";
import { cn } from "@/lib/cn";

export interface FilterChip {
  key: string;
  label: ReactNode;
  /** Accessible description of what is removed, e.g. "Date: last 7 days". */
  description?: string;
  onRemove?: () => void;
}

export interface FilterChipsProps {
  chips: FilterChip[];
  onAdd?: () => void;
  addLabel?: ReactNode;
  onClearAll?: () => void;
  summary?: ReactNode;
  className?: string;
  /** Slot for a custom "add filter" trigger (a Popover) instead of `onAdd`. */
  addControl?: ReactNode;
}

export function FilterChips({
  chips,
  onAdd,
  addLabel = "Add filter",
  onClearAll,
  summary,
  className,
  addControl,
}: FilterChipsProps) {
  return (
    <div
      className={cn("flex flex-wrap items-center gap-2", className)}
      role="group"
      aria-label="Active filters"
    >
      {chips.map((chip) => (
        <span
          key={chip.key}
          className="inline-flex h-[30px] items-center gap-1 rounded-pill bg-brand-100 py-0 pr-1.5 pl-3 text-[12px] font-semibold text-brand-700"
        >
          {chip.label}
          {chip.onRemove ? (
            <button
              type="button"
              onClick={chip.onRemove}
              aria-label={`Remove filter ${chip.description ?? (typeof chip.label === "string" ? chip.label : chip.key)}`}
              className="inline-flex size-5 items-center justify-center rounded-full hover:bg-brand-200"
            >
              <X size={12} strokeWidth={2.5} aria-hidden />
            </button>
          ) : null}
        </span>
      ))}
      {addControl ??
        (onAdd ? (
          <Button variant="tonal" size="xs" onClick={onAdd}>
            <Plus aria-hidden />
            {addLabel}
          </Button>
        ) : null)}
      {onClearAll && chips.length > 0 ? (
        <Button variant="ghost" size="xs" onClick={onClearAll} className="text-muted">
          Clear all
        </Button>
      ) : null}
      {summary ? <span className="ml-auto text-[13px] text-muted">{summary}</span> : null}
    </div>
  );
}
