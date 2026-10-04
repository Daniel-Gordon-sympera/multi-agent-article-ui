/**
 * StatTile — mockup §3.1: label 13/600 muted, value 30/600 tabular, up to two sub-labels (a
 * `delta` with tone muted/positive/warn and a `note`), optional Sparkline at the right.
 */
import type { ReactNode } from "react";
import { Sparkline } from "@/components/Sparkline";
import { cn } from "@/lib/cn";

export interface StatTileDelta {
  text: ReactNode;
  tone?: "muted" | "positive" | "warn" | "fail";
}

export interface StatTileProps {
  label: ReactNode;
  value: ReactNode;
  delta?: StatTileDelta;
  note?: ReactNode;
  sparkline?: readonly number[];
  className?: string;
  loading?: boolean;
}

const deltaTone = {
  muted: "text-muted",
  positive: "text-status-done-fg",
  warn: "text-status-warn-fg",
  fail: "text-status-fail-fg",
};

export function StatTile({
  label,
  value,
  delta,
  note,
  sparkline,
  className,
  loading,
}: StatTileProps) {
  return (
    <div
      className={cn(
        "card flex min-w-0 flex-1 basis-[220px] flex-col gap-2 px-5 py-[18px]",
        className,
      )}
    >
      <p className="text-[13px] font-semibold text-muted">{label}</p>
      <div className="flex items-end justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1.5">
          <p
            className={cn(
              "text-[30px] leading-none font-semibold tracking-[-0.02em] text-ink tabular",
              loading && "animate-pulse text-muted",
            )}
          >
            {loading ? "—" : value}
          </p>
          {delta ? (
            <p className={cn("text-[12px] font-semibold", deltaTone[delta.tone ?? "muted"])}>
              {delta.text}
            </p>
          ) : null}
          {note ? <p className="text-[12px] text-muted">{note}</p> : null}
        </div>
        {sparkline && sparkline.length > 1 ? <Sparkline values={sparkline} /> : null}
      </div>
    </div>
  );
}
