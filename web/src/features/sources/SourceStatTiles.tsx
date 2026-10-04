/**
 * The four Data Sources tiles (mockup §3.10): Active sources · Promoted from the finder ·
 * Median precision · last run (needs capability `sources_stats`) · Removed.
 */
import type { Source, SourceStats } from "@/api/types/bff";
import { StatTile } from "@/components/StatTile";
import { formatPercent } from "@/lib/format";
import { PRECISION_NOTE } from "./sourceColumns";
import { promotedThisWeek } from "./sourcePresentation";

export interface SourceStatTilesProps {
  stats: SourceStats | undefined;
  rows: readonly Source[] | undefined;
  loading: boolean;
}

export function SourceStatTiles({ stats, rows, loading }: SourceStatTilesProps) {
  const thisWeek = rows ? promotedThisWeek(rows) : 0;
  const counties = stats?.counties ?? 0;
  return (
    <div className="flex flex-wrap gap-4" aria-label="Source statistics" role="group">
      <StatTile
        label="Active sources"
        value={stats?.active ?? "—"}
        loading={loading}
        note={`across ${counties} ${counties === 1 ? "county" : "counties"}`}
      />
      <StatTile
        label="Promoted from the finder"
        value={stats?.promoted ?? "—"}
        loading={loading}
        delta={thisWeek > 0 ? { text: `+${thisWeek} this week`, tone: "positive" } : undefined}
        note="finder-judged, kept by you"
      />
      <StatTile
        label="Median precision · last run"
        value={
          stats?.median_precision === null || stats?.median_precision === undefined
            ? "—"
            : formatPercent(stats.median_precision)
        }
        loading={loading}
        delta={
          stats && stats.median_precision === null
            ? { text: PRECISION_NOTE, tone: "muted" }
            : undefined
        }
        note="accepted articles ÷ candidates"
      />
      <StatTile
        label="Removed"
        value={stats?.removed ?? "—"}
        loading={loading}
        note="kept for history, never seeded"
      />
    </div>
  );
}
