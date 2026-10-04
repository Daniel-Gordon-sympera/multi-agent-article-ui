/**
 * The 7 curated sources of mockup-spec §4.6, the finder suggestions (the 4 drawn ones first,
 * then the rest of the "See all 11") and the tile baseline (Active 23 · Promoted 12 · Removed 4).
 */
import type { Source, SourceStats, Suggestion } from "@/api/types/bff";
import { daysAgo } from "./clock";
import { JOB_IDS } from "./jobs";

/**
 * The mockup's tiles describe a larger list than the 7 fixture rows; the handler keeps these
 * numbers in step with mutations (add → +1 active, remove → +1 removed, …).
 */
export const SOURCE_STATS_BASELINE: SourceStats = {
  active: 23,
  promoted: 12,
  removed: 4,
  counties: 5,
  median_precision: 0.11,
};

export function buildSourceFixtures(): Source[] {
  const make = (
    id: string,
    name: string,
    domain: string,
    county: string,
    state: string,
    industries: string[],
    origin: Source["origin"],
    createdDaysAgo: number,
    rank: number | null,
    precision: { accepted: number; candidates: number; jobId: string; daysAgo: number },
    status: Source["status"] = "active",
  ): Source => ({
    id,
    name,
    domain,
    url: `https://${domain}`,
    county,
    state_code: state,
    industries,
    origin,
    finder:
      origin === "finder"
        ? {
            tier: rank && rank <= 2 ? "high" : "medium",
            verdict: "accept",
            reason: "Kept by the finder (coverage: local, relevance: high)",
            judged_at: daysAgo(createdDaysAgo),
            rank,
            job_id: precision.jobId,
          }
        : null,
    status,
    created_at: daysAgo(createdDaysAgo),
    removed_at: status === "removed" ? daysAgo(3) : null,
    precision: {
      accepted: precision.accepted,
      candidates: precision.candidates,
      ratio: precision.candidates ? precision.accepted / precision.candidates : null,
      job_id: precision.jobId,
      at: daysAgo(precision.daysAgo),
    },
  });
  return [
    make(
      "src-0001",
      "Orlando Magazine",
      "orlandomagazine.com",
      "Orange",
      "FL",
      ["Construction", "Manufacturing"],
      "finder",
      4,
      1,
      { accepted: 18, candidates: 142, jobId: JOB_IDS.orangeConstruction, daysAgo: 0 },
    ),
    make(
      "src-0002",
      "Orlando Sentinel",
      "orlandosentinel.com",
      "Orange",
      "FL",
      ["Construction", "Health Care"],
      "finder",
      4,
      2,
      { accepted: 14, candidates: 131, jobId: JOB_IDS.orangeConstruction, daysAgo: 0 },
    ),
    make(
      "src-0003",
      "GrowthSpotter",
      "growthspotter.com",
      "Orange",
      "FL",
      ["Construction"],
      "manual",
      6,
      5,
      { accepted: 2, candidates: 46, jobId: JOB_IDS.orangeConstruction, daysAgo: 0 },
    ),
    make(
      "src-0004",
      "Range Wire",
      "rangewire.com",
      "Jefferson",
      "CO",
      ["Construction"],
      "manual",
      14,
      null,
      { accepted: 9, candidates: 88, jobId: JOB_IDS.jeffersonConstruction, daysAgo: 0 },
    ),
    make(
      "src-0005",
      "Houston Ledger",
      "houstonledger.com",
      "Harris",
      "TX",
      ["Manufacturing"],
      "finder",
      10,
      1,
      { accepted: 11, candidates: 97, jobId: JOB_IDS.harrisManufacturingEarlier, daysAgo: 2 },
    ),
    make(
      "src-0006",
      "Sonoran Post",
      "sonoranpost.com",
      "Maricopa",
      "AZ",
      ["Retail Trade"],
      "manual",
      16,
      3,
      { accepted: 4, candidates: 63, jobId: JOB_IDS.maricopaRetail, daysAgo: 1 },
    ),
    make(
      "src-0007",
      "Prairie Post",
      "prairiepost.com",
      "Cook",
      "IL",
      ["Utilities"],
      "manual",
      22,
      null,
      { accepted: 0, candidates: 41, jobId: JOB_IDS.cookUtilities, daysAgo: 3 },
      "removed",
    ),
  ];
}

export function buildSuggestionFixtures(): Suggestion[] {
  return [
    {
      domain: "orlandoweekly.com",
      name: "Orlando Weekly",
      url: "https://orlandoweekly.com",
      tier: "medium",
      verdict: "accept",
      reason: "Kept by the finder (coverage: local, relevance: medium); explored, no sections kept",
      judged_at: daysAgo(0),
      rank: 4,
      job_id: JOB_IDS.orangeConstruction,
      county: "Orange",
      state_code: "FL",
      industry: "Construction",
      origin: "ranking",
    },
    {
      domain: "floridadaily.com",
      name: "Florida Daily",
      url: "https://floridadaily.com",
      tier: "high",
      verdict: "accept",
      reason: "Kept by the finder (coverage: state, relevance: high); ranked 4th",
      judged_at: daysAgo(0),
      rank: 4,
      job_id: JOB_IDS.orangeManufacturing,
      county: "Orange",
      state_code: "FL",
      industry: "Manufacturing",
      origin: "ranking",
    },
    {
      domain: "westorlandonews.com",
      name: "West Orlando News",
      url: "https://westorlandonews.com",
      tier: "medium",
      verdict: "accept",
      reason: "Kept by the finder (coverage: local, relevance: high); ranked 6th",
      judged_at: daysAgo(1),
      rank: 6,
      job_id: JOB_IDS.orangeConstruction,
      county: "Orange",
      state_code: "FL",
      industry: "Construction",
      origin: "ranking",
    },
    {
      domain: "denverite.com",
      name: "Denverite",
      url: "https://denverite.com",
      tier: "high",
      verdict: "accept",
      reason: "Found through the judged-domain memory (judged Sep 21, kept)",
      judged_at: daysAgo(13),
      rank: null,
      job_id: null,
      county: "Jefferson",
      state_code: "CO",
      industry: "Construction",
      origin: "finder_memory",
    },
    ...MORE_SUGGESTIONS,
  ];
}

const JOB_BY_STATE: Record<string, string> = {
  FL: JOB_IDS.orangeConstruction,
  CO: JOB_IDS.jeffersonConstruction,
  TX: JOB_IDS.harrisManufacturingEarlier,
  AZ: JOB_IDS.maricopaRetail,
};

function ordinal(n: number): string {
  const suffix = n % 100 >= 11 && n % 100 <= 13 ? "th" : (["th", "st", "nd", "rd"][n % 10] ?? "th");
  return `${n}${suffix}`;
}

function suggestion(
  domain: string,
  county: string,
  state: string,
  industry: string,
  tier: string,
  rank: number | null,
  judgedDaysAgo: number,
): Suggestion {
  const name = domain
    .replace(/\.(com|org|net)$/, "")
    .replace(/[-.]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
  const coverage = tier === "high" ? "state" : "local";
  return {
    domain,
    name,
    url: `https://${domain}`,
    tier,
    verdict: "accept",
    reason:
      rank === null
        ? `Found through the judged-domain memory (judged ${judgedDaysAgo} days ago, kept)`
        : `Kept by the finder (coverage: ${coverage}, relevance: ${tier}); ranked ${ordinal(rank)}`,
    judged_at: daysAgo(judgedDaysAgo),
    rank,
    job_id: rank === null ? null : (JOB_BY_STATE[state] ?? null),
    county,
    state_code: state,
    industry,
    origin: rank === null ? "finder_memory" : "ranking",
  };
}

/** Suggestions 5–11 behind "See all 11" (lower ranks and older memory verdicts). */
const MORE_SUGGESTIONS: Suggestion[] = [
  suggestion("orlandobusinessjournal.com", "Orange", "FL", "Construction", "high", 7, 0),
  suggestion("centralfloridapost.com", "Orange", "FL", "Manufacturing", "medium", 8, 1),
  suggestion("apopkavoice.com", "Orange", "FL", "Construction", "medium", 9, 1),
  suggestion("winterparkmag.com", "Orange", "FL", "Wholesale Trade", "medium", 11, 2),
  suggestion("coloradosun.com", "Jefferson", "CO", "Construction", "high", null, 9),
  suggestion("houstonchronicle.com", "Harris", "TX", "Manufacturing", "high", 2, 2),
  suggestion("azcentral.com", "Maricopa", "AZ", "Retail Trade", "high", null, 6),
];
