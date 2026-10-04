/** The four KPI tiles of mockup §3.1, fed by `GET /app/overview`. */
import type { OverviewSummary } from "@/api/types/bff";
import { ErrorState } from "@/components/ErrorState";
import { StatTile } from "@/components/StatTile";
import { formatInteger } from "@/lib/format";
import {
  DEAD_TASKS_HINT,
  costDelta,
  costValue,
  deadTasksDelta,
  runningJobsSubLabel,
  scoutsLabel,
  signalsDelta,
} from "./overviewFormat";

export interface OverviewTilesProps {
  summary: OverviewSummary | undefined;
  loading: boolean;
  error: unknown;
  onRetry: () => void;
}

export function OverviewTiles({ summary, loading, error, onRetry }: OverviewTilesProps) {
  if (error && !summary) {
    return <ErrorState error={error} title="The overview could not be loaded" onRetry={onRetry} />;
  }
  const pending = loading && !summary;
  return (
    <section aria-label="Key figures" className="flex flex-wrap gap-4">
      <StatTile
        label="Running jobs"
        loading={pending}
        value={summary ? formatInteger(summary.running_jobs.total) : "—"}
        delta={
          summary ? { text: runningJobsSubLabel(summary.running_jobs), tone: "muted" } : undefined
        }
        note={summary ? scoutsLabel(summary.running_jobs) : undefined}
      />
      <StatTile
        label="Signals · last 7 days"
        loading={pending}
        value={summary ? formatInteger(summary.signals_7d.count) : "—"}
        delta={summary ? signalsDelta(summary.signals_7d) : undefined}
        sparkline={summary?.signals_7d.series}
      />
      <StatTile
        label="Model + proxy cost · today"
        loading={pending}
        value={summary ? costValue(summary.cost_today) : "—"}
        delta={summary ? costDelta(summary.cost_today) : undefined}
        sparkline={summary?.cost_today.series}
      />
      <StatTile
        label="Dead tasks"
        loading={pending}
        value={summary ? formatInteger(summary.dead_tasks.count) : "—"}
        delta={summary ? deadTasksDelta(summary.dead_tasks) : undefined}
        note={DEAD_TASKS_HINT}
      />
    </section>
  );
}
