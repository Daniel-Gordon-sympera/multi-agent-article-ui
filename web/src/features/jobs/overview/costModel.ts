/**
 * Cost-by-stage model (mockup §3.5 / §4.1): ledger rows grouped by stage label (finder stages
 * and the ranker share one row), bar shares and the proxy-traffic figure.
 */
import type { JobCost, StoredJobSummary } from "@/api/types/jobs";
import type { SiteRun } from "@/api/types/siteRuns";
import type { HorizontalBarRow } from "@/components/HorizontalBars";
import { formatCompactNumber, formatInteger, formatMoney } from "@/lib/format";

/** Ledger stage → the label drawn in the mockup; finder stages and the ranker are one row. */
export function stageLabel(stage: string): string {
  if (stage.startsWith("finder") || stage === "ranker" || stage === "rank_sites") {
    return "Finder + ranker";
  }
  const known: Record<string, string> = {
    classification: "Classification",
    summary: "Summary",
    company_pass: "Company pass",
    company: "Company pass",
    enrichment: "Enrichment",
    sections_agent: "Sections agent",
    sections: "Sections agent",
  };
  return known[stage] ?? stage.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

interface StageTotal {
  label: string;
  calls: number;
  tokens: number;
  cost: number;
  agents: boolean;
}

export function costRows(costs: readonly JobCost[]): HorizontalBarRow[] {
  const totals = new Map<string, StageTotal>();
  for (const cost of costs) {
    const label = stageLabel(cost.stage);
    const current = totals.get(label) ?? {
      label,
      calls: 0,
      tokens: 0,
      cost: 0,
      agents: label === "Sections agent",
    };
    current.calls += cost.calls;
    current.tokens += cost.total_tokens;
    current.cost += cost.cost_usd ?? cost.known_cost_usd ?? 0;
    totals.set(label, current);
  }
  const rows = [...totals.values()].sort((a, b) => b.cost - a.cost);
  const max = rows[0]?.cost ?? 0;
  return rows.map((row) => ({
    key: row.label,
    label: row.label,
    subLabel: `${formatInteger(row.calls)} ${row.agents ? "agents" : "calls"} · ${formatCompactNumber(row.tokens)} tokens`,
    pct: max > 0 ? row.cost / max : 0,
    value: formatMoney(row.cost),
  }));
}

export function proxyBytes(
  summary: StoredJobSummary | null,
  siteRuns: readonly SiteRun[],
): number | null {
  const fromSummary = summary?.bytes_fetched;
  if (typeof fromSummary === "number") return fromSummary;
  const fromRuns = siteRuns.reduce((sum, run) => sum + (run.stats.bytes ?? 0), 0);
  return fromRuns > 0 ? fromRuns : null;
}
