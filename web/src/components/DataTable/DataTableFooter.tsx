/**
 * Pagination footer — mockup §3.2: "Showing 1–8 of 12 runs" at the left, `‹ Previous` /
 * `Next ›` sm secondary buttons at the right; "of N" appears only when a total is known.
 */
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import { formatShowing, type PageFooterState } from "@/api/pagination";
import { Button } from "@/components/Button";
import { cn } from "@/lib/cn";

export interface DataTablePagination extends PageFooterState {
  /** Singular noun for the footer ("run", "signal"). */
  noun?: string;
  pluralNoun?: string;
  /** Extra text after the count (mockup §3.6 adds a column explanation). */
  note?: ReactNode;
  loading?: boolean;
}

export function DataTableFooter({
  showing,
  hasNext,
  hasPrev,
  onNext,
  onPrev,
  noun = "row",
  pluralNoun,
  note,
  loading,
  className,
}: DataTablePagination & { className?: string }) {
  return (
    <div className={cn("flex flex-wrap items-center justify-between gap-3 px-5 py-3", className)}>
      <p className="text-[13px] text-muted" aria-live="polite">
        {formatShowing(showing, noun, pluralNoun)}
        {note ? <> · {note}</> : null}
      </p>
      <div className="flex items-center gap-2">
        <Button variant="secondary" size="sm" onClick={onPrev} disabled={!hasPrev || loading}>
          <ChevronLeft aria-hidden />
          Previous
        </Button>
        <Button variant="secondary" size="sm" onClick={onNext} disabled={!hasNext || loading}>
          Next
          <ChevronRight aria-hidden />
        </Button>
      </div>
    </div>
  );
}
