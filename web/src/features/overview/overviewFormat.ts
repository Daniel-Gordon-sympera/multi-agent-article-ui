import { formatArticleDate } from "@/lib/articleDate";
/**
 * Pure wording of the Overview tiles (mockup §3.1 / §4.8): "2 queued · 1 finalizing",
 * "across 3 Scouts", "+18% vs previous 7 days", "+$3.10 vs yesterday", "1 new since yesterday".
 */
import type {
  ActiveRun,
  OverviewCost,
  OverviewDeadTasks,
  OverviewRunningJobs,
  OverviewSignals,
} from "@/api/types/overview";
import type { CrossJobSignalRow } from "@/api/types/signals";
import type { StatTileDelta } from "@/components/StatTile";
import { formatInteger, formatLocation, formatMoney, pluralize } from "@/lib/format";

export function runningJobsSubLabel(running: OverviewRunningJobs): string {
  const parts: string[] = [];
  if (running.by_status.queued > 0) parts.push(`${running.by_status.queued} queued`);
  if (running.by_status.finalizing > 0) parts.push(`${running.by_status.finalizing} finalizing`);
  if (parts.length) return parts.join(" · ");
  return running.total === 0 ? "nothing queued" : "all in progress";
}

export function scoutsLabel(running: OverviewRunningJobs): string {
  if (running.scouts === 0) return running.total === 0 ? "no runs right now" : "no Scout runs";
  return `across ${pluralize(running.scouts, "Scout")}`;
}

export function signalsDelta(signals: OverviewSignals): StatTileDelta {
  if (signals.delta_pct === null)
    return { text: "no signals in the previous 7 days", tone: "muted" };
  const sign = signals.delta_pct > 0 ? "+" : "";
  return {
    text: `${sign}${signals.delta_pct}% vs previous 7 days`,
    tone: signals.delta_pct > 0 ? "positive" : signals.delta_pct < 0 ? "warn" : "muted",
  };
}

export function costValue(cost: OverviewCost): string {
  if (!cost.cost_complete || cost.usd === null) return "—";
  return formatMoney(cost.usd);
}

export function costDelta(cost: OverviewCost): StatTileDelta {
  if (!cost.cost_complete || cost.delta_usd === null) {
    return { text: "some calls lack pricing — see Stats & costs", tone: "warn" };
  }
  return { text: `${formatMoney(cost.delta_usd, { signed: true })} vs yesterday`, tone: "muted" };
}

export function deadTasksDelta(dead: OverviewDeadTasks): StatTileDelta {
  if (dead.new_since_yesterday === null)
    return { text: "new since yesterday: unknown", tone: "muted" };
  if (dead.new_since_yesterday === 0) return { text: "none new since yesterday", tone: "muted" };
  return { text: `${dead.new_since_yesterday} new since yesterday`, tone: "warn" };
}

export const DEAD_TASKS_HINT = "retry from the job's Tasks tab";

/** "5 / 5" · "– / 5" when the finished count is unknown · "—" without seeds. */
export function formatSites(sites: ActiveRun["sites"]): string {
  if (!sites || !sites.total) return "—";
  return `${sites.done === null ? "–" : sites.done} / ${sites.total}`;
}

export function formatSignals(run: ActiveRun): string {
  const signals = run.progress?.signals ?? 0;
  return signals > 0 ? formatInteger(signals) : "—";
}

/** "$3.12" · "—" before the first model call (null or zero cost). */
export function formatRunCost(run: ActiveRun): string {
  if (run.cost_usd === null || run.cost_usd === 0) return "—";
  return formatMoney(run.cost_usd);
}

/** "Major Contract Awarded · Orange County, FL · Oct 2" under the company name. */
export function signalMeta(row: CrossJobSignalRow): string {
  return [
    row.signal_title ?? row.signal ?? "Signal",
    formatLocation(row.county, row.state_code),
    formatArticleDate(row.date, row.date_precision),
  ].join(" · ");
}
