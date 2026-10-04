/**
 * SearchInput — mockup §3.2: toolbar search (h36, white, border-strong, search icon at left 11).
 * Debounces `onValueChange` (250 ms) so the URL only updates once typing pauses; Enter and the
 * clear button apply immediately.
 */
import { Search, X } from "lucide-react";
import { useEffect, useRef, useState, type ComponentProps } from "react";
import { cn } from "@/lib/cn";

export interface SearchInputProps extends Omit<
  ComponentProps<"input">,
  "value" | "onChange" | "size"
> {
  value: string | undefined;
  onValueChange: (value: string | undefined) => void;
  /** Accessible name; also the placeholder unless `placeholder` is set. */
  label: string;
  width?: number;
  debounceMs?: number;
  inputSize?: "form" | "toolbar";
}

export function SearchInput({
  value,
  onValueChange,
  label,
  placeholder,
  width = 230,
  debounceMs = 250,
  inputSize = "toolbar",
  className,
  ...props
}: SearchInputProps) {
  const [draft, setDraft] = useState(value ?? "");
  const lastEmitted = useRef(value ?? "");

  // Follow external changes (URL navigation, "Clear all").
  useEffect(() => {
    const external = value ?? "";
    if (external !== lastEmitted.current) {
      lastEmitted.current = external;
      setDraft(external);
    }
  }, [value]);

  useEffect(() => {
    if (draft === lastEmitted.current) return;
    const timer = window.setTimeout(() => {
      lastEmitted.current = draft;
      onValueChange(draft.trim() === "" ? undefined : draft);
    }, debounceMs);
    return () => window.clearTimeout(timer);
  }, [debounceMs, draft, onValueChange]);

  const commit = (next: string) => {
    lastEmitted.current = next;
    setDraft(next);
    onValueChange(next.trim() === "" ? undefined : next);
  };

  return (
    <div className={cn("relative shrink-0", className)} style={{ width }}>
      <Search
        size={inputSize === "toolbar" ? 16 : 15}
        strokeWidth={2}
        className="pointer-events-none absolute top-1/2 left-[11px] -translate-y-1/2 text-muted"
        aria-hidden
      />
      <input
        type="search"
        role="searchbox"
        aria-label={label}
        placeholder={placeholder ?? label}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") commit(draft);
          if (event.key === "Escape" && draft) commit("");
        }}
        className={cn(
          "w-full rounded-control border border-border-strong bg-surface pl-8 text-ink outline-none placeholder:text-faint",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
          "[&::-webkit-search-cancel-button]:hidden",
          inputSize === "toolbar" ? "h-9 text-[13px]" : "h-10 text-[14px]",
          draft ? "pr-8" : "pr-3",
        )}
        {...props}
      />
      {draft ? (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => commit("")}
          className="absolute top-1/2 right-1.5 inline-flex size-6 -translate-y-1/2 items-center justify-center rounded-tag text-muted hover:bg-surface-2 hover:text-ink"
        >
          <X size={14} strokeWidth={2.25} aria-hidden />
        </button>
      ) : null}
    </div>
  );
}
