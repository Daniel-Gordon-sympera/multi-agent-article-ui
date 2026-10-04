/**
 * SplitBar — mockup §3.8 "By materiality": 320×10 bar (gap 2, radius 5) with the brand ramp
 * 700/400/200 for high/medium/low, plus a legend with 10 px squares and counts.
 */
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export interface SplitBarSegment {
  key: string;
  label: ReactNode;
  value: number;
  color: string;
}

export interface SplitBarProps {
  segments: SplitBarSegment[];
  width?: number;
  className?: string;
  ariaLabel?: string;
}

/** The brand ramp for materiality, in order High → Medium → Low. */
export const MATERIALITY_COLORS = {
  High: "var(--brand-700)",
  Medium: "var(--brand-400)",
  Low: "var(--brand-200)",
} as const;

export function SplitBar({
  segments,
  width = 320,
  className,
  ariaLabel = "Breakdown",
}: SplitBarProps) {
  const total = segments.reduce((sum, s) => sum + Math.max(0, s.value), 0);
  return (
    <div className={cn("flex flex-wrap items-center gap-5", className)}>
      <div
        role="img"
        aria-label={`${ariaLabel}: ${segments.map((s) => `${s.value} ${typeof s.label === "string" ? s.label : s.key}`).join(", ")}`}
        className="flex h-2.5 max-w-full gap-0.5 overflow-hidden rounded-kbd"
        style={{ width }}
      >
        {segments.map((s) => (
          <div
            key={s.key}
            className="h-full"
            style={{
              width: `${total ? (Math.max(0, s.value) / total) * 100 : 0}%`,
              background: s.color,
            }}
          />
        ))}
      </div>
      <ul className="flex flex-wrap items-center gap-4 text-[12px] text-ink-2">
        {segments.map((s) => (
          <li key={s.key} className="inline-flex items-center gap-1.5">
            <span className="size-2.5 rounded-bar" style={{ background: s.color }} aria-hidden />
            {s.label} <strong className="font-semibold text-ink tabular">{s.value}</strong>
          </li>
        ))}
      </ul>
    </div>
  );
}
