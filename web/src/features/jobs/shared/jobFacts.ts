/**
 * Small derivations shared by the Runs table and the job detail: the StageBar hint from a
 * progress row or a stored summary, cost totals and token totals from the cost ledger.
 */
import type { JobCost, JobProgress, StoredJobSummary } from "@/api/types/jobs";
import type { StageProgressHint } from "@/lib/status";

type ProgressLike = Partial<JobProgress> | StoredJobSummary | null | undefined;

const num = (value: unknown): number | undefined =>
  typeof value === "number" && Number.isFinite(value) ? value : undefined;

/** `StageBar` accepts counts without nulls; summaries carry `number | null`. */
export function stageHintOf(source: ProgressLike): StageProgressHint | null {
  if (!source) return null;
  return {
    seeds: num(source.seeds),
    sections: num(source.sections),
    articles: num(source.articles),
    summaries: num(source.summaries),
  };
}

/** Sum of the ledger: complete cost when known, else the priced part. */
export function totalCostUsd(costs: readonly JobCost[] | null | undefined): number | null {
  if (!costs || costs.length === 0) return null;
  return costs.reduce((sum, c) => sum + (c.cost_usd ?? c.known_cost_usd ?? 0), 0);
}

export function totalTokens(costs: readonly JobCost[] | null | undefined): number | null {
  if (!costs || costs.length === 0) return null;
  return costs.reduce((sum, c) => sum + (c.total_tokens ?? 0), 0);
}

export function totalCalls(costs: readonly JobCost[] | null | undefined): number {
  return (costs ?? []).reduce((sum, c) => sum + (c.calls ?? 0), 0);
}

/** True when any ledger row lacks pricing or usage, so the total is a lower bound. */
export function costIncomplete(costs: readonly JobCost[] | null | undefined): boolean {
  return (costs ?? []).some(
    (c) => c.cost_usd === null || c.unpriced_calls > 0 || c.unknown_usage_calls > 0,
  );
}
