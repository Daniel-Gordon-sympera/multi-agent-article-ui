/**
 * Settings › Stats & costs: 14-day sparklines (jobs, signals, cost) over the daily table with
 * keyset "Load more" and a CSV export of the loaded rows (client-side, `lib/csv`).
 */
import { Download } from "lucide-react";
import { useMemo } from "react";
import type { DailyStats } from "@/api/types/stats";
import { Button } from "@/components/Button";
import { StatTile } from "@/components/StatTile";
import { downloadText, rowsToCsv } from "@/lib/csv";
import { formatInteger, formatMoney, pluralize } from "@/lib/format";
import { SettingsSection } from "../SettingsSection";
import { useDailyStatsPages } from "../useSettingsQueries";
import { DailyStatsTable } from "./DailyStatsTable";
import { DAILY_STATS_CSV_COLUMNS, dayCost, recentSeries, sumOf } from "./statsFormat";

export function StatsPage() {
  const pages = useDailyStatsPages();
  const rows = useMemo<DailyStats[]>(
    () => pages.data?.pages.flatMap((page) => page.items) ?? [],
    [pages.data],
  );
  const recent = useMemo(
    () => [...rows].sort((a, b) => b.day.localeCompare(a.day)).slice(0, 14),
    [rows],
  );
  const incompleteDays = recent.filter((row) => !row.cost_complete).length;

  const exportCsv = () => {
    const today = new Date().toISOString().slice(0, 10);
    downloadText(`scout-daily-stats-${today}.csv`, rowsToCsv(rows, DAILY_STATS_CSV_COLUMNS));
  };

  return (
    <SettingsSection
      id="settings-stats"
      title="Stats & costs"
      description="One row per day from the pipeline's ledger: throughput, tokens, model + proxy cost and the failures by category."
      actions={
        <Button variant="secondary" onClick={exportCsv} disabled={rows.length === 0}>
          <Download aria-hidden />
          Export CSV
        </Button>
      }
    >
      <div className="flex flex-wrap gap-4" aria-label="Last 14 days">
        <StatTile
          label="Jobs · last 14 days"
          loading={pages.isPending}
          value={formatInteger(sumOf(recent, (r) => r.jobs))}
          sparkline={recentSeries(recent, (r) => r.jobs)}
        />
        <StatTile
          label="Signals · last 14 days"
          loading={pages.isPending}
          value={formatInteger(sumOf(recent, (r) => r.signals))}
          sparkline={recentSeries(recent, (r) => r.signals)}
        />
        <StatTile
          label="Model + proxy cost · last 14 days"
          loading={pages.isPending}
          value={formatMoney(sumOf(recent, dayCost))}
          delta={
            incompleteDays
              ? { text: `${pluralize(incompleteDays, "day")} with unpriced calls`, tone: "warn" }
              : undefined
          }
          sparkline={recentSeries(recent, dayCost)}
        />
      </div>
      <DailyStatsTable
        rows={rows}
        loading={pages.isPending}
        error={pages.error}
        onRetry={() => void pages.refetch()}
        footer={
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-5 py-3">
            <p className="text-[13px] text-muted" aria-live="polite">
              {rows.length ? `Showing ${pluralize(rows.length, "day")}` : "No days"}
              {pages.hasNextPage ? " · more available" : ""}
            </p>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => void pages.fetchNextPage()}
              disabled={!pages.hasNextPage}
              loading={pages.isFetchingNextPage}
            >
              Load more
            </Button>
          </div>
        }
      />
    </SettingsSection>
  );
}
