/**
 * KeyValueGrid — mockup §5: 2-column label (12 muted) / value (13/600) grid; `mono` values for
 * ids and settings (Settings card, New-run Summary, drawer Company profile).
 */
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export interface KeyValueItem {
  label: ReactNode;
  value: ReactNode;
  mono?: boolean;
  /** Full-width row (spans both columns). */
  wide?: boolean;
}

export interface KeyValueGridProps {
  items: KeyValueItem[];
  columns?: 1 | 2 | 3;
  className?: string;
  /** `stacked` puts the label above the value (default); `inline` puts them side by side. */
  layout?: "stacked" | "inline";
}

export function KeyValueGrid({
  items,
  columns = 2,
  className,
  layout = "stacked",
}: KeyValueGridProps) {
  return (
    <dl
      className={cn(
        "grid gap-x-4 gap-y-3.5",
        columns === 1 && "grid-cols-1",
        columns === 2 && "grid-cols-2",
        columns === 3 && "grid-cols-3",
        className,
      )}
    >
      {items.map((item, index) => (
        <div
          key={index}
          className={cn(
            "min-w-0",
            layout === "inline"
              ? "flex items-baseline justify-between gap-3"
              : "flex flex-col gap-0.5",
            item.wide && "col-span-full",
          )}
        >
          <dt className="text-[12px] text-muted">{item.label}</dt>
          <dd
            className={cn(
              "min-w-0 text-[13px] font-semibold text-ink break-words",
              item.mono && "font-mono font-medium",
            )}
          >
            {item.value ?? <span className="text-muted">—</span>}
          </dd>
        </div>
      ))}
    </dl>
  );
}
