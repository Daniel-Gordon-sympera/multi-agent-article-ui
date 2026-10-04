/**
 * Industries multi-select — mockup §3.4: a bordered box (min-height 48) with brand tokens (h30,
 * × "Remove {industry}") and an inline input "Add an industry…" backed by the NAICS catalog
 * (`data/industries.json`, labels without the code). Typeahead listbox with arrow keys, Enter
 * adds the highlighted match, Backspace on an empty input removes the last token.
 */
import { X } from "lucide-react";
import { useId, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { industrySuggestions } from "./industriesCatalog";

export interface IndustryTokenInputProps {
  value: string[];
  onChange: (next: string[]) => void;
  id?: string;
  invalid?: boolean;
  describedBy?: string;
  placeholder?: string;
  disabled?: boolean;
}

export function IndustryTokenInput({
  value,
  onChange,
  id,
  invalid,
  describedBy,
  placeholder = "Add an industry…",
  disabled,
}: IndustryTokenInputProps) {
  const [draft, setDraft] = useState("");
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();

  const matches = useMemo(() => industrySuggestions(draft, value), [draft, value]);

  const add = (label: string) => {
    if (!value.includes(label)) onChange([...value, label]);
    setDraft("");
    setHighlight(0);
    setOpen(false);
    inputRef.current?.focus();
  };

  const remove = (label: string) => {
    onChange(value.filter((v) => v !== label));
    inputRef.current?.focus();
  };

  return (
    <div className="relative">
      <div
        className={cn(
          "flex min-h-12 flex-wrap items-center gap-1.5 rounded-control border bg-surface px-2.5 py-2",
          invalid ? "border-status-fail-fg" : "border-border-strong",
          disabled && "bg-surface-2",
        )}
      >
        {value.map((label) => (
          <span
            key={label}
            className="inline-flex h-[30px] items-center gap-1 rounded-control bg-brand-100 pr-1 pl-2.5 text-[13px] font-semibold text-brand-700"
          >
            {label}
            <button
              type="button"
              aria-label={`Remove ${label}`}
              disabled={disabled}
              onClick={(event) => {
                event.stopPropagation();
                remove(label);
              }}
              className="inline-flex size-5 items-center justify-center rounded-full hover:bg-brand-200 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring"
            >
              <X size={12} strokeWidth={2.5} aria-hidden />
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          id={id}
          role="combobox"
          aria-expanded={open && matches.length > 0}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          aria-activedescendant={open && matches[highlight] ? `${listId}-${highlight}` : undefined}
          disabled={disabled}
          placeholder={value.length ? "Add another…" : placeholder}
          value={draft}
          className="h-[30px] min-w-[160px] flex-1 bg-transparent text-[14px] text-ink outline-none placeholder:text-muted"
          onChange={(event) => {
            setDraft(event.target.value);
            setHighlight(0);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => window.setTimeout(() => setOpen(false), 120)}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setOpen(true);
              setHighlight((h) => Math.min(matches.length - 1, h + 1));
            } else if (event.key === "ArrowUp") {
              event.preventDefault();
              setHighlight((h) => Math.max(0, h - 1));
            } else if (event.key === "Enter") {
              const pick = matches[highlight];
              if (pick) {
                event.preventDefault();
                add(pick);
              } else if (draft.trim()) {
                event.preventDefault();
              }
            } else if (event.key === "Escape") {
              setOpen(false);
            } else if (event.key === "Backspace" && !draft && value.length) {
              onChange(value.slice(0, -1));
            }
          }}
        />
      </div>
      {open && matches.length > 0 ? (
        <ul
          id={listId}
          role="listbox"
          aria-label="Industries from the NAICS catalog"
          className="absolute top-full left-0 z-30 mt-1 max-h-64 w-full overflow-y-auto rounded-banner border border-border bg-surface p-1 shadow-popover"
        >
          {matches.map((label, index) => (
            <li
              key={label}
              id={`${listId}-${index}`}
              role="option"
              aria-selected={index === highlight}
              className={cn(
                "flex h-8 cursor-default items-center rounded-tag px-2.5 text-[13px] text-ink",
                index === highlight && "bg-brand-100 text-brand-700",
              )}
              onMouseDown={(event) => event.preventDefault()}
              onMouseEnter={() => setHighlight(index)}
              onClick={() => add(label)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") add(label);
              }}
            >
              {label}
            </li>
          ))}
        </ul>
      ) : null}
      {open && draft.trim() && matches.length === 0 ? (
        <p className="absolute top-full left-0 z-30 mt-1 w-full rounded-banner border border-border bg-surface px-3 py-2 text-[13px] text-muted shadow-popover">
          No industry in the catalog matches “{draft.trim()}”.
        </p>
      ) : null}
    </div>
  );
}
