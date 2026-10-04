/**
 * "Cost by stage" card — mockup §3.5: "$3.12 · from the model-call ledger", HorizontalBars
 * (label / "N calls · N tokens", bar = share of the costliest stage, "$x.xx") and the proxy
 * traffic footnote (`summary.bytes_fetched`, else the site runs' bytes).
 */
import type { JobCost, StoredJobSummary } from "@/api/types/jobs";
import type { SiteRun } from "@/api/types/siteRuns";
import { Card, CardHeader } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { HorizontalBars } from "@/components/HorizontalBars";
import { costIncomplete, totalCostUsd } from "@/features/jobs/shared/jobFacts";
import { formatBytes, formatMoney } from "@/lib/format";
import { costRows, proxyBytes } from "./costModel";

export interface CostByStageCardProps {
  costs: readonly JobCost[];
  summary: StoredJobSummary | null;
  siteRuns: readonly SiteRun[];
  terminal: boolean;
}

export function CostByStageCard({ costs, summary, siteRuns, terminal }: CostByStageCardProps) {
  const total = totalCostUsd(costs);
  const rows = costRows(costs);
  const bytes = proxyBytes(summary, siteRuns);
  return (
    <Card aria-labelledby="cost-by-stage-title">
      <CardHeader
        id="cost-by-stage-title"
        title="Cost by stage"
        subtitle={`${formatMoney(total)} · from the model-call ledger${costIncomplete(costs) ? " (some calls unpriced)" : ""}`}
      />
      {rows.length ? (
        <HorizontalBars rows={rows} ariaLabel="Cost by stage" />
      ) : (
        <EmptyState
          variant="plain"
          title="No model calls yet"
          description="The ledger fills as the finder, sections agent and analysis make calls."
        />
      )}
      <p className="text-[12px] text-muted">
        {bytes === null
          ? "Proxy traffic: not reported yet (billed per GB, shown separately once priced)."
          : `Proxy traffic: ${formatBytes(bytes)}${terminal ? "" : " so far"} (billed per GB, shown separately once priced).`}
      </p>
    </Card>
  );
}
