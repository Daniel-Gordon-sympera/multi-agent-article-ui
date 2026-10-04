/**
 * HorizontalBars — mockup §3.5 "Cost by stage" and §3.11 "Dead tasks by category": rows of
 * label (+ sub-label) · track (brand-100, radius 0 4 4 0) with brand-500 fill · value.
 */
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export interface HorizontalBarRow {
  key?: string;
  label: ReactNode;
  subLabel?: ReactNode;
  /** 0–1 share of the longest bar. */
  pct: number;
  value: ReactNode;
  mono?: boolean;
}

export interface HorizontalBarsProps {
  rows: HorizontalBarRow[];
  /** `wide` = 128 | 1fr | 56 (h18); `narrow` = 180 | 1fr | 32 (h16). */
  layout?: "wide" | "narrow";
  className?: string;
  ariaLabel?: string;
}

export function HorizontalBars({
  rows,
  layout = "wide",
  className,
  ariaLabel,
}: HorizontalBarsProps) {
  const grid =
    layout === "wide"
      ? "grid-cols-[128px_minmax(0,1fr)_56px]"
      : "grid-cols-[180px_minmax(0,1fr)_32px]";
  const barHeight = layout === "wide" ? "h-[18px]" : "h-4";
  return (
    <ul className={cn("flex flex-col gap-2.5", className)} aria-label={ariaLabel}>
      {rows.map((row, index) => (
        <li key={row.key ?? index} className={cn("grid items-center gap-3", grid)}>
          <div className="min-w-0">
            <p
              className={cn(
                "truncate text-[13px] font-medium text-ink",
                row.mono && "font-mono text-[12px]",
              )}
            >
              {row.label}
            </p>
            {row.subLabel ? (
              <p className="truncate text-[11px] text-muted">{row.subLabel}</p>
            ) : null}
          </div>
          <div
            className={cn("overflow-hidden rounded-r-[4px] bg-brand-100", barHeight)}
            aria-hidden
          >
            <div
              className="h-full rounded-r-[4px] bg-brand-500"
              style={{ width: `${Math.max(0, Math.min(1, row.pct)) * 100}%` }}
            />
          </div>
          <p className="text-right text-[13px] text-ink tabular">{row.value}</p>
        </li>
      ))}
    </ul>
  );
}
