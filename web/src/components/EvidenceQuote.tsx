/**
 * EvidenceQuote — mockup §3.9: blockquote (padding 14×16, radius 10, brand-50 bg, brand-200
 * border, 14 px, lh 1.55) with the verbatim quote in curly quotes and a verification meta row.
 */
import { Check } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export interface EvidenceCheck {
  label: string;
  /** true → check icon; false → shown as plain text "not …". */
  ok?: boolean;
}

export interface EvidenceQuoteProps {
  quote: string;
  checks?: EvidenceCheck[];
  /** Extra meta entries ("quote #3", "role: subject"). */
  meta?: ReactNode[];
  className?: string;
  cite?: string;
}

export function EvidenceQuote({
  quote,
  checks = [],
  meta = [],
  className,
  cite,
}: EvidenceQuoteProps) {
  const text = quote.trim().replace(/^[“"]+|[”"]+$/g, "");
  return (
    <figure className={cn("flex flex-col gap-2.5", className)}>
      <blockquote
        cite={cite}
        className="rounded-banner border border-brand-200 bg-brand-50 px-4 py-3.5 text-[14px] leading-[1.55] text-ink"
      >
        “{text}”
      </blockquote>
      {meta.length || checks.length ? (
        <figcaption className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-muted">
          {meta.map((entry, i) => (
            <span key={`m${i}`}>{entry}</span>
          ))}
          {checks.map((check) => (
            <span key={check.label} className="inline-flex items-center gap-1">
              {check.label}
              {check.ok === false ? (
                <span className="text-status-warn-fg">✕</span>
              ) : (
                <Check
                  size={12}
                  strokeWidth={2.5}
                  className="text-status-done-fg"
                  aria-label="verified"
                />
              )}
            </span>
          ))}
        </figcaption>
      ) : null}
    </figure>
  );
}
