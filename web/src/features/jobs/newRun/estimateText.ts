/** Wording of the Summary card's "Estimated cost" row and its footnote (mockup §3.4). */
import type { Estimate } from "@/api/types/bff";
import { formatMoney, pluralize } from "@/lib/format";

type KnownEstimate = Estimate & { median_cost_usd: number; p90_cost_usd: number };

export function knownEstimate(estimate: Estimate | undefined): KnownEstimate | null {
  if (
    !estimate ||
    estimate.samples === 0 ||
    estimate.median_cost_usd === null ||
    estimate.p90_cost_usd === null
  )
    return null;
  return {
    ...estimate,
    median_cost_usd: estimate.median_cost_usd,
    p90_cost_usd: estimate.p90_cost_usd,
  };
}

/** "≈ $3.12 per job" · "—" (no samples) · "…" while loading. */
export function estimateText(
  estimate: Estimate | undefined,
  loading: boolean,
  failed = false,
): string {
  if (failed) return "—";
  if (loading && !estimate) return "…";
  const known = knownEstimate(estimate);
  return known ? `≈ ${formatMoney(known.median_cost_usd)} per job` : "—";
}

export function estimateFootnote(
  raw: Estimate | undefined,
  loading = false,
  failed = false,
): string {
  if (failed) return "Estimate unavailable. Try again when the pipeline API is available.";
  if (!raw) return loading ? "Loading the cost estimate…" : "Estimate unavailable.";
  const estimate = knownEstimate(raw);
  if (!estimate) {
    if (raw?.excluded_incomplete_jobs) {
      return `Estimate unavailable: ${pluralize(raw.excluded_incomplete_jobs, "matching completed job")} had incomplete recorded model costs.`;
    }
    return raw.samples === 0
      ? "No completed run with these settings yet — the first one sets the estimate."
      : "Estimate unavailable: recorded model costs are incomplete.";
  }
  const runs = pluralize(estimate.samples, "completed run");
  const p90 = `p90 ${formatMoney(estimate.p90_cost_usd)}`;
  const excluded = estimate.excluded_incomplete_jobs ?? 0;
  return `Recorded model cost from ${runs}; ${p90}. Proxy transfer fees are excluded.${excluded ? ` ${excluded} jobs with incomplete costs were excluded.` : ""}`;
}
