import { describe, expect, it } from "vitest";
import type { Estimate } from "@/api/types/bff";
import { estimateFootnote, estimateText } from "./estimateText";

const noEstimate: Estimate = {
  median_cost_usd: null,
  p90_cost_usd: null,
  samples: 0,
  excluded_incomplete_jobs: 0,
  basis: "recorded_model_calls",
};

describe("cost estimate coverage", () => {
  it("does not report missing history while loading or after an API failure", () => {
    expect(estimateFootnote(undefined, true)).toBe("Loading the cost estimate…");
    expect(estimateFootnote(undefined)).toBe("Estimate unavailable.");
    expect(estimateFootnote(undefined, false, true)).toContain("Estimate unavailable");
    expect(estimateFootnote(noEstimate, false, true)).not.toContain("No completed run");
    const cached = { ...noEstimate, samples: 3, median_cost_usd: 2, p90_cost_usd: 4 };
    expect(estimateText(cached, false, true)).toBe("—");
    expect(estimateFootnote(cached, false, true)).toContain("Estimate unavailable");
  });

  it("distinguishes missing history from incomplete recorded costs", () => {
    expect(estimateFootnote(noEstimate)).toContain("No completed run");
    const incomplete = { ...noEstimate, excluded_incomplete_jobs: 2 };
    expect(estimateText(incomplete, false)).toBe("—");
    expect(estimateFootnote(incomplete)).toContain("2 matching completed jobs");
    expect(estimateFootnote(incomplete)).toContain("incomplete recorded model costs");
    expect(estimateFootnote(incomplete)).not.toContain("No completed run");
  });
});
