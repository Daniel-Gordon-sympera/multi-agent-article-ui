/**
 * "By materiality" strip (mockup §3.8): white box with the 320×10 split bar in the lavender
 * ramp, the High / Medium / Low legend with counts and "Top signal this week: Mass Hiring (19)"
 * at the right, all from `GET /app/signals/summary`.
 */
import type { CrossJobSignalsSummary } from "@/api/types/bff";
import { Skeleton } from "@/components/Skeleton";
import { MATERIALITY_COLORS, SplitBar } from "@/components/SplitBar";
import { topSignalLabel } from "./explorerText";

export interface SignalsMaterialityStripProps {
  summary: CrossJobSignalsSummary | undefined;
  loading?: boolean;
  dateAfter?: string;
  dateBefore?: string;
}

export function SignalsMaterialityStrip({
  summary,
  loading = false,
  dateAfter,
  dateBefore,
}: SignalsMaterialityStripProps) {
  const counts = summary?.by_materiality ?? { high: 0, medium: 0, low: 0 };
  return (
    <div
      className="flex flex-wrap items-center gap-5 rounded-banner border border-border bg-surface px-4 py-3"
      aria-label="By materiality"
    >
      <span className="text-[13px] font-semibold text-ink">By materiality</span>
      {loading && !summary ? (
        <Skeleton className="h-2.5 w-80" />
      ) : (
        <SplitBar
          ariaLabel="Signals by materiality"
          segments={[
            { key: "high", label: "High", value: counts.high, color: MATERIALITY_COLORS.High },
            {
              key: "medium",
              label: "Medium",
              value: counts.medium,
              color: MATERIALITY_COLORS.Medium,
            },
            { key: "low", label: "Low", value: counts.low, color: MATERIALITY_COLORS.Low },
          ]}
        />
      )}
      <span className="ml-auto text-[12px] text-muted" data-testid="top-signal">
        {topSignalLabel(summary, dateAfter, dateBefore)}
      </span>
    </div>
  );
}
