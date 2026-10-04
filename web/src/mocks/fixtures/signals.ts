/**
 * Signal rows (mockup-spec §4.5): the 13 named signals plus generated ones so the main job
 * carries 24 signals, each shaped like `analysis.signals` ⋈ company flags (contract §1).
 * `buildSignalFixtures()` feeds `db.signals` (the main job's rows + the 5 named rows of other
 * jobs); `OTHER_JOB_SIGNALS` adds deterministic rows for the other jobs so the explorer and
 * the per-job tabs agree with every job's `progress.signals` counter.
 */
import type { SignalRow } from "@/api/types/signals";
import { signalKeyForTitle } from "@/features/signals/signalCatalog";
import { dateDaysAgo } from "./clock";
import { JOB_IDS, MAIN_JOB_ID } from "./jobs";
import { NAMED_SIGNAL_SEEDS as named, type SignalSeed } from "./signalSeeds";
import { buildOtherJobSeeds } from "./signalsOtherJobs";

const GENERATED_COMPANIES = [
  [
    "Winter Park Mechanical",
    "Construction",
    "Plumbing & HVAC contractors",
    "$1M-$10M",
    "General Hiring Activity",
    "Medium",
  ],
  [
    "Lake Nona Logistics",
    "Transportation and Warehousing",
    "Warehousing",
    "$20M-$50M",
    "New Office or Location Opening",
    "Medium",
  ],
  [
    "Apopka Precast",
    "Manufacturing",
    "Concrete products",
    "$10M-$20M",
    "Operational Capacity Expansion",
    "High",
  ],
  [
    "Ocoee Electric Co.",
    "Construction",
    "Electrical contractors",
    "$1M-$10M",
    "Major Contract Awarded",
    "Medium",
  ],
  [
    "Horizon West Homes",
    "Construction",
    "Residential building",
    "$20M-$50M",
    "Groundbreaking Ceremony",
    "Low",
  ],
  [
    "Kissimmee Paving",
    "Construction",
    "Highway and street",
    "$1M-$10M",
    "Major Contract Awarded",
    "Medium",
  ],
  [
    "Orlando Tower Cranes",
    "Construction",
    "Equipment rental",
    "$10M-$20M",
    "Capital Raise",
    "High",
  ],
  [
    "Sanford Timber Supply",
    "Wholesale Trade",
    "Lumber wholesale",
    "<$1M",
    "New Product or Service Launch",
    "Low",
  ],
  [
    "Celebration Interiors",
    "Construction",
    "Finishing contractors",
    "$1M-$10M",
    "Industry Award or Recognition",
    "Low",
  ],
  [
    "Windermere Glass Works",
    "Manufacturing",
    "Glass products",
    "$1M-$10M",
    "Closed Deal",
    "Medium",
  ],
  [
    "Maitland Site Services",
    "Construction",
    "Site preparation",
    "$10M-$20M",
    "Mass Hiring",
    "High",
  ],
] as const;

/** Mention id → job id, filled while the rows are built (rows carry no job column). */
const JOB_OF_SIGNAL = new Map<number, string>();

export const slugify = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

function countyOf(jobId: string): string {
  switch (jobId) {
    case JOB_IDS.jeffersonConstruction:
      return "Jefferson";
    case JOB_IDS.fultonWholesale:
      return "Fulton";
    case JOB_IDS.maricopaRetail:
      return "Maricopa";
    case JOB_IDS.harrisManufacturingEarlier:
    case JOB_IDS.harrisManufacturingQueued:
      return "Harris";
    default:
      return "Orange";
  }
}

const stateCountyOf = (seed: SignalSeed): string =>
  seed.scope === "local" ? countyOf(seed.jobId) : seed.scope === "state" ? "Osceola" : "";

/** One API-shaped row from a seed; `id` is the mention id the drawer deep-links to. */
export function seedToRow(seed: SignalSeed, id: number): SignalRow {
  const confidenceLevel =
    seed.confidence >= 0.85 ? "high" : seed.confidence >= 0.75 ? "medium" : "low";
  const unknownRevenue = seed.revenue === "unknown" || seed.revenue === "NA";
  JOB_OF_SIGNAL.set(id, seed.jobId);
  return {
    id,
    summary_id: id - 4000,
    article_id: seed.articleId,
    company_id: id - 6000,
    number_company: 1,
    name_as_written: seed.company,
    entity_type: seed.org === "gov" ? "government" : "company",
    role: "subject",
    quote_id: 3,
    evidence: seed.evidence,
    confidence_score: seed.confidence,
    confidence_level: confidenceLevel,
    checks: ["verbatim_match", "name_grounded"],
    signal: signalKeyForTitle(seed.signal) ?? seed.signal,
    signal_title: seed.signal,
    materiality: seed.materiality,
    connection: "direct",
    signal_quote_id: 3,
    signal_evidence: seed.evidence,
    url: `https://${seed.domain}/${slugify(seed.title)}`,
    title: seed.title,
    date: dateDaysAgo(seed.daysAgo),
    source_domain: seed.domain,
    article_key: `art_${seed.articleId}`,
    company_key: slugify(seed.company),
    company: seed.company,
    confidence: confidenceLevel,
    fetch_status: "ok",
    org_kind: seed.org,
    org_kind_basis: seed.org === "gov" ? "name cue" : "name cue",
    hq_scope: seed.scope,
    entity_flag: seed.org === "gov" ? "gov" : seed.scope,
    hq_county: stateCountyOf(seed),
    hq_state: seed.state,
    scope_place: seed.city,
    scope_basis: "explicit place",
    company_industry: seed.industry,
    company_sub_industry: seed.subIndustry,
    industry_basis: "article industry",
    revenue_bin: seed.revenue,
    revenue_basis: unknownRevenue ? "none" : "explicit figure",
    revenue_confidence: unknownRevenue ? 0 : 0.8,
    enrichment_source: "rules_v1",
  };
}

/** Main-job signals: the 8 named Orange County ones + 16 generated = 24, plus the 5 named rows of other jobs. */
export function buildSignalFixtures(): SignalRow[] {
  const generated: SignalSeed[] = [];
  const domains = [
    "orlandomagazine.com",
    "orlandosentinel.com",
    "growthspotter.com",
    "bizjournals.com/orlando",
  ];
  const cities = ["Orlando", "Winter Park", "Apopka", "Ocoee", "Kissimmee", "Sanford"];
  for (let i = 0; i < 16; i += 1) {
    const base = GENERATED_COMPANIES[i % GENERATED_COMPANIES.length]!;
    const suffix = i >= GENERATED_COMPANIES.length ? ` ${i - GENERATED_COMPANIES.length + 2}` : "";
    const city = cities[i % cities.length]!;
    generated.push({
      company: `${base[0]}${suffix}`,
      org: "business",
      signal: base[4],
      materiality: base[5],
      confidence: Number((0.7 + ((i * 7) % 25) / 100).toFixed(2)),
      evidence: `${base[0]}${suffix} announced plans this week, according to the report, with work expected to start within the quarter.`,
      city,
      scope: city === "Kissimmee" || city === "Sanford" ? "state" : "local",
      state: "FL",
      industry: base[1],
      subIndustry: base[2],
      revenue: base[3],
      daysAgo: 3 + (i % 11),
      domain: domains[i % domains.length]!,
      title: `${base[0]}${suffix} in the news`,
      jobId: MAIN_JOB_ID,
      articleId: 71360 + i,
    });
  }
  return [...named, ...generated].map((seed, index) => seedToRow(seed, 9000 + index));
}

/** Rows of the other jobs (ids from 10000), sized to each job's `progress.signals`. */
export const OTHER_JOB_SIGNALS: readonly SignalRow[] = buildOtherJobSeeds(
  named.filter((seed) => seed.jobId !== MAIN_JOB_ID),
).map((seed, index) => seedToRow(seed, 10_000 + index));

/** Which job a fixture signal belongs to (by mention id). */
export function signalJobId(row: Pick<SignalRow, "id">): string {
  return JOB_OF_SIGNAL.get(row.id) ?? MAIN_JOB_ID;
}

/** Every signal row of every job: the mutable `db.signals` plus the static other-job rows. */
export function allSignalRows(mainRows: readonly SignalRow[]): SignalRow[] {
  return [...mainRows, ...OTHER_JOB_SIGNALS];
}
