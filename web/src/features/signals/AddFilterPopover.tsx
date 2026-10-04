/**
 * "+ Add filter" (mockup §3.8, picker not drawn): a popover listing the §4.4 filters; picking
 * one shows its control (select, text or date range with presets) and "Apply" writes the value
 * into the URL search. Filters already active are listed too so a value can be replaced.
 */
import { ArrowLeft, Plus } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/Button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { SignalFilterKey, SignalsSearch } from "./searchSchema";
import {
  DATE_PRESETS,
  FILTER_DEFINITIONS,
  datePresetOf,
  isoDateDaysAgo,
  type SignalFilterDefinition,
} from "./signalFilters";

export type SearchPatch = Partial<Record<SignalFilterKey, string | undefined>>;

export interface AddFilterPopoverProps {
  search: SignalsSearch;
  onApply: (patch: SearchPatch) => void;
}

export function AddFilterPopover({ search, onApply }: AddFilterPopoverProps) {
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<SignalFilterDefinition | null>(null);

  const close = () => {
    setOpen(false);
    setPicked(null);
  };
  const apply = (patch: SearchPatch) => {
    onApply(patch);
    close();
  };

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setPicked(null);
      }}
    >
      <PopoverTrigger asChild>
        <Button variant="tonal" size="xs" aria-haspopup="dialog">
          <Plus aria-hidden />
          Add filter
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[300px]" aria-label="Add filter">
        {picked ? (
          <FilterValueForm
            definition={picked}
            search={search}
            onBack={() => setPicked(null)}
            onApply={apply}
          />
        ) : (
          <div className="flex flex-col gap-1">
            <p className="px-1 pb-1 text-section-head text-muted">Filter by</p>
            <ul className="flex flex-col">
              {FILTER_DEFINITIONS.map((definition) => {
                const active =
                  definition.control === "date-range"
                    ? Boolean(search.date_after || search.date_before)
                    : Boolean(search[definition.key]);
                return (
                  <li key={definition.key}>
                    <button
                      type="button"
                      onClick={() => setPicked(definition)}
                      className="flex h-8 w-full items-center justify-between rounded-tag px-2 text-left text-[13px] text-ink hover:bg-surface-2"
                    >
                      {definition.label}
                      {active ? <span className="text-[11px] text-muted">active</span> : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

interface FilterValueFormProps {
  definition: SignalFilterDefinition;
  search: SignalsSearch;
  onBack: () => void;
  onApply: (patch: SearchPatch) => void;
}

function FilterValueForm({ definition, search, onBack, onApply }: FilterValueFormProps) {
  const current = definition.control === "date-range" ? "" : (search[definition.key] ?? "");
  const [value, setValue] = useState(current);
  const [after, setAfter] = useState(search.date_after ?? "");
  const [before, setBefore] = useState(search.date_before ?? "");
  const inputId = `add-filter-${definition.key}`;

  const submit = () => {
    if (definition.control === "date-range") {
      onApply({ date_after: after || undefined, date_before: before || undefined });
      return;
    }
    const trimmed = value.trim();
    onApply({ [definition.key]: trimmed ? trimmed : undefined });
  };

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label="Back to the filter list"
          onClick={onBack}
        >
          <ArrowLeft aria-hidden />
        </Button>
        <span className="text-[13px] font-semibold text-ink">{definition.label}</span>
      </div>
      {definition.control === "select" && definition.options ? (
        <Select value={value} onValueChange={setValue}>
          <SelectTrigger aria-label={definition.label}>
            <SelectValue placeholder={`Choose a ${definition.label.toLowerCase()}`} />
          </SelectTrigger>
          <SelectContent>
            {definition.options.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : definition.control === "date-range" ? (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap gap-1.5">
            {DATE_PRESETS.map((preset) => (
              <Button
                key={preset.value}
                variant={datePresetOf(after, before) === preset.value ? "tonal" : "secondary"}
                size="xs"
                onClick={() => {
                  setAfter(isoDateDaysAgo(preset.days));
                  setBefore("");
                }}
              >
                {preset.label}
              </Button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1">
              <Label htmlFor={`${inputId}-after`}>From</Label>
              <Input
                id={`${inputId}-after`}
                type="date"
                inputSize="toolbar"
                value={after}
                onChange={(event) => setAfter(event.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor={`${inputId}-before`}>To</Label>
              <Input
                id={`${inputId}-before`}
                type="date"
                inputSize="toolbar"
                value={before}
                onChange={(event) => setBefore(event.target.value)}
              />
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-1">
          <Label htmlFor={inputId}>{definition.label}</Label>
          <Input
            id={inputId}
            inputSize="toolbar"
            value={value}
            placeholder={definition.placeholder}
            onChange={(event) => setValue(event.target.value)}
          />
        </div>
      )}
      {definition.hint ? <p className="text-[12px] text-muted">{definition.hint}</p> : null}
      <div className="flex justify-end gap-2">
        <Button variant="primary" size="sm" type="submit">
          Apply
        </Button>
      </div>
    </form>
  );
}
