/** Wording of the Summary card's "Estimated cost" row and its footnote (mockup §3.4). */
import type { Estimate } from "@/api/types/bff";
import { formatMoney, pluralize } from "@/lib/format";

type KnownEstimate = Exclude<Estimate, { samples: 0 }>;

export function knownEstimate(estimate: Estimate | undefined): KnownEstimate | null {
  if (!estimate || !("median_cost_usd" in estimate) || estimate.samples === 0) return null;
  return estimate;
}

/** "≈ $3.12 per job" · "—" (no samples) · "…" while loading. */
export function estimateText(estimate: Estimate | undefined, loading: boolean): string {
  if (loading && !estimate) return "…";
  const known = knownEstimate(estimate);
  return known ? `≈ ${formatMoney(known.median_cost_usd)} per job` : "—";
}

export function estimateFootnote(raw: Estimate | undefined): string {
  const estimate = knownEstimate(raw);
  if (!estimate) {
    return "No completed run with these settings yet — the first one sets the estimate.";
  }
  const runs = pluralize(estimate.samples, "completed run");
  const p90 = `p90 ${formatMoney(estimate.p90_cost_usd)}`;
  if (estimate.basis === "api") {
    return `Estimate from the pipeline API over ${runs} (model + proxy); ${p90}.`;
  }
  return `Estimate from the last ${runs} with these settings (model + proxy); ${p90}.`;
}
