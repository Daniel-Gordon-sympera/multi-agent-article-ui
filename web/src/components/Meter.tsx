/**
 * Meter — mockup §5: h6 bar, track brand-100, fill brand-600; widths 44 (record cell), 72
 * (sources), 140 (drawer); optional trailing label in tabular 12 px.
 */
import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

export interface MeterProps extends Omit<ComponentProps<"div">, "children"> {
  /** 0–1 ratio, or 0–100 when `percent` is true. */
  value: number | null | undefined;
  percent?: boolean;
  width?: number;
  label?: string;
  ariaLabel?: string;
}

export function Meter({
  value,
  percent = false,
  width = 44,
  label,
  ariaLabel,
  className,
  ...props
}: MeterProps) {
  const ratio =
    value === null || value === undefined || !Number.isFinite(value)
      ? 0
      : percent
        ? value / 100
        : value;
  const clamped = Math.max(0, Math.min(1, ratio));
  return (
    <div className={cn("inline-flex items-center gap-2", className)} {...props}>
      <div
        role="meter"
        aria-label={ariaLabel ?? label ?? "value"}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(clamped * 100)}
        className="h-1.5 shrink-0 overflow-hidden rounded-pill bg-brand-100"
        style={{ width }}
      >
        <div className="h-full rounded-pill bg-brand-600" style={{ width: `${clamped * 100}%` }} />
      </div>
      {label ? <span className="text-[12px] text-ink-2 tabular">{label}</span> : null}
    </div>
  );
}
