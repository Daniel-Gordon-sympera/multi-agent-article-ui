/**
 * FilterSelect — mockup §3.2: h36 select whose first option reads "Label: all" (or the
 * configured default wording, mockup §6.8); the trigger always shows "Label: value".
 * `undefined` means "all" so the filter disappears from the URL.
 */
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/cn";

export interface FilterOption {
  value: string;
  label: string;
}

export interface FilterSelectProps {
  label: string;
  value: string | undefined;
  onValueChange: (value: string | undefined) => void;
  options: FilterOption[];
  /** Wording of the "everything" option (default "all"). `null` removes it. */
  allLabel?: string | null;
  width?: number;
  size?: "form" | "toolbar";
  disabled?: boolean;
  className?: string;
  id?: string;
}

const ALL = "__all__";

export function FilterSelect({
  label,
  value,
  onValueChange,
  options,
  allLabel = "all",
  width,
  size = "toolbar",
  disabled,
  className,
  id,
}: FilterSelectProps) {
  const current = value && options.some((o) => o.value === value) ? value : ALL;
  const currentLabel =
    current === ALL
      ? (allLabel ?? "all")
      : (options.find((o) => o.value === current)?.label ?? current);
  return (
    <Select
      value={current}
      onValueChange={(next) => onValueChange(next === ALL ? undefined : next)}
      disabled={disabled}
    >
      <SelectTrigger
        id={id}
        size={size}
        aria-label={label}
        className={cn("w-auto min-w-[100px] shrink-0", className)}
        style={width ? { minWidth: width } : undefined}
      >
        <SelectValue>
          <span className="text-muted">{label}: </span>
          {currentLabel}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {allLabel !== null ? (
          <SelectItem value={ALL}>
            {label}: {allLabel}
          </SelectItem>
        ) : null}
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** Builds options from plain strings. */
export function toOptions(
  values: readonly string[],
  labelOf: (v: string) => string = (v) => v,
): FilterOption[] {
  return values.map((value) => ({ value, label: labelOf(value) }));
}
