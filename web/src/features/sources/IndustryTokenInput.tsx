/**
 * Industries token input (mockup §3.4 "Industries" box): brand tokens with a "Remove {industry}"
 * button, an inline text input that suggests NAICS labels from `data/industries.json` while
 * you type (as an overlay, so nothing below moves); Enter or a comma adds the typed label,
 * Backspace on an empty input removes the last token.
 */
import { X } from "lucide-react";
import { useId, useMemo, useState } from "react";
import { cn } from "@/lib/cn";
import { INDUSTRY_CATALOG, canonicalIndustry } from "./industryCatalog";

export interface IndustryTokenInputProps {
  value: string[];
  onChange: (industries: string[]) => void;
  id?: string;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  maxSuggestions?: number;
  className?: string;
}

export function IndustryTokenInput({
  value,
  onChange,
  id,
  label = "Industries",
  placeholder = "Add an industry…",
  disabled,
  maxSuggestions = 8,
  className,
}: IndustryTokenInputProps) {
  const [draft, setDraft] = useState("");
  const [focused, setFocused] = useState(false);
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const listId = `${inputId}-suggestions`;

  const suggestions = useMemo(() => {
    const query = draft.trim().toLowerCase();
    const taken = new Set(value.map((v) => v.toLowerCase()));
    return INDUSTRY_CATALOG.filter(
      (entry) =>
        !taken.has(entry.label.toLowerCase()) &&
        query !== "" &&
        entry.label.toLowerCase().includes(query),
    ).slice(0, maxSuggestions);
  }, [draft, maxSuggestions, value]);

  const add = (text: string) => {
    const industry = canonicalIndustry(text);
    if (!industry) return;
    if (!value.some((v) => v.toLowerCase() === industry.toLowerCase())) {
      onChange([...value, industry]);
    }
    setDraft("");
  };

  const remove = (industry: string) => onChange(value.filter((v) => v !== industry));

  return (
    <div className={cn("relative flex flex-col gap-1.5", className)}>
      <div
        className={cn(
          "flex min-h-12 flex-wrap items-center gap-1.5 rounded-control border border-border-strong bg-surface px-2.5 py-2",
          focused && "outline-2 outline-offset-2 outline-ring",
          disabled && "bg-surface-2",
        )}
      >
        {value.map((industry) => (
          <span
            key={industry}
            className="inline-flex h-[30px] items-center gap-1 rounded-control bg-brand-100 pr-1 pl-2.5 text-[13px] font-semibold text-brand-700"
          >
            {industry}
            <button
              type="button"
              aria-label={`Remove ${industry}`}
              disabled={disabled}
              onClick={() => remove(industry)}
              className="inline-flex size-5 items-center justify-center rounded-tag text-brand-700 hover:bg-brand-200"
            >
              <X size={12} strokeWidth={2.5} aria-hidden />
            </button>
          </span>
        ))}
        <input
          id={inputId}
          type="text"
          aria-label={label}
          aria-describedby={listId}
          autoComplete="off"
          disabled={disabled}
          placeholder={value.length ? "" : placeholder}
          value={draft}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            setFocused(false);
            if (draft.trim()) add(draft);
          }}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === ",") {
              if (draft.trim()) {
                event.preventDefault();
                add(draft);
              } else if (event.key === "Enter") {
                event.preventDefault();
              }
            } else if (event.key === "Backspace" && draft === "" && value.length) {
              remove(value[value.length - 1]!);
            } else if (event.key === "Escape") {
              setDraft("");
            }
          }}
          className="h-[30px] min-w-[140px] flex-1 bg-transparent text-[13px] text-ink outline-none placeholder:text-faint"
        />
      </div>
      <div
        id={listId}
        role="group"
        aria-label={`${label} suggestions`}
        // An overlay (not in the flow) so opening/closing it never moves the buttons below.
        className={cn(
          "absolute top-full right-0 left-0 z-20 mt-1 flex flex-wrap gap-1.5 rounded-control border border-border bg-surface p-2 shadow-popover",
          !(focused && suggestions.length > 0) && "hidden",
        )}
      >
        {suggestions.map((entry) => (
          <button
            key={entry.code}
            type="button"
            tabIndex={-1}
            // mousedown keeps the input focused so the blur handler does not run first
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => add(entry.label)}
            className="inline-flex h-7 items-center rounded-control border border-border bg-surface-2 px-2.5 text-[12px] font-medium text-ink-2 hover:bg-brand-50 hover:text-brand-700"
          >
            {entry.label}
          </button>
        ))}
      </div>
    </div>
  );
}
