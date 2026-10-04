/**
 * CounterStrip — mockup §3.5: left group of counters (label 12 muted / value 18/600, divided
 * by hairlines) and a right group of secondary pairs (label 12 / value 13/600).
 */
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export interface CounterItem {
  key?: string;
  label: ReactNode;
  value: ReactNode;
}

export interface CounterStripProps {
  counters: CounterItem[];
  secondary?: CounterItem[];
  className?: string;
}

export function CounterStrip({ counters, secondary = [], className }: CounterStripProps) {
  return (
    <div className={cn("flex flex-wrap items-start justify-between gap-x-6 gap-y-4", className)}>
      <dl className="flex flex-wrap">
        {counters.map((item, index) => (
          <div
            key={item.key ?? index}
            className={cn(
              "flex flex-col gap-0.5",
              index < counters.length - 1 && "mr-5 border-r border-border pr-5",
            )}
          >
            <dt className="text-[12px] text-muted">{item.label}</dt>
            <dd className="text-[18px] leading-tight font-semibold tracking-[-0.01em] text-ink tabular">
              {item.value}
            </dd>
          </div>
        ))}
      </dl>
      {secondary.length ? (
        <dl className="flex flex-wrap gap-6">
          {secondary.map((item, index) => (
            <div key={item.key ?? index} className="flex flex-col gap-0.5">
              <dt className="text-[12px] text-muted">{item.label}</dt>
              <dd className="text-[13px] font-semibold text-ink tabular">{item.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </div>
  );
}
