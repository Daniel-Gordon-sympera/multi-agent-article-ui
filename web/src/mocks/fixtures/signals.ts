/**
 * Signal rows (mockup-spec §4.5): the 13 named signals plus generated ones so the main job
 * carries 24 signals, each shaped like `analysis.signals` ⋈ company flags (contract §1).
 */
import type { SignalRow } from "@/api/types/signals";
import { dateDaysAgo } from "./clock";
import { JOB_IDS, MAIN_JOB_ID } from "./jobs";
import { NAMED_SIGNAL_SEEDS as named, type SignalSeed } from "./signalSeeds";

const GENERATED_COMPANIES = [
  [
    "Winter Park Mechanical",
    "Construction",
    "Plumbing & HVAC contractors",
    "$1M-$10M",
    "Hiring",
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

const slug = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

function toRow(seed: SignalSeed, index: number): SignalRow {
  const id = 9000 + index;
  const confidenceLevel =
    seed.confidence >= 0.85 ? "high" : seed.confidence >= 0.75 ? "medium" : "low";
  return {
    id,
    summary_id: 5000 + index,
    article_id: seed.articleId,
    company_id: 3000 + index,
    number_company: 1,
    name_as_written: seed.company,
    entity_type: seed.org === "gov" ? "government" : "company",
    role: "subject",
    quote_id: 3,
    evidence: seed.evidence,
    confidence_score: seed.confidence,
    confidence_level: confidenceLevel,
    checks: ["verbatim_match", "name_grounded"],
    signal: seed.signal,
    signal_title: seed.signal,
    materiality: seed.materiality,
    connection: "direct",
    signal_quote_id: 3,
    signal_evidence: seed.evidence,
    url: `https://${seed.domain}/${slug(seed.title)}`,
    title: seed.title,
    date: dateDaysAgo(seed.daysAgo),
    source_domain: seed.domain,
    article_key: `art_${seed.articleId}`,
    company_key: slug(seed.company),
    company: seed.company,
    confidence: confidenceLevel,
    fetch_status: "ok",
    org_kind: seed.org,
    org_kind_basis: seed.org === "gov" ? "name cue" : "name cue",
    hq_scope: seed.scope,
    entity_flag: seed.org === "gov" ? "gov" : seed.scope,
    hq_county:
      seed.scope === "local" ? countyOf(seed.jobId) : seed.scope === "state" ? "Osceola" : "",
    hq_state: seed.state,
    scope_place: seed.city,
    scope_basis: "explicit place",
    company_industry: seed.industry,
    company_sub_industry: seed.subIndustry,
    industry_basis: "article industry",
    revenue_bin: seed.revenue,
    revenue_basis: seed.revenue === "unknown" || seed.revenue === "NA" ? "none" : "explicit figure",
    revenue_confidence: seed.revenue === "unknown" || seed.revenue === "NA" ? 0 : 0.8,
    enrichment_source: "rules_v1",
  };
}

function countyOf(jobId: string): string {
  switch (jobId) {
    case JOB_IDS.jeffersonConstruction:
      return "Jefferson";
    case JOB_IDS.fultonWholesale:
      return "Fulton";
    case JOB_IDS.maricopaRetail:
      return "Maricopa";
    case JOB_IDS.harrisManufacturingEarlier:
      return "Harris";
    default:
      return "Orange";
  }
}

/** Main-job signals: the 8 named Orange County ones + 16 generated = 24. */
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
      daysAgo: 2 + (i % 12),
      domain: domains[i % domains.length]!,
      title: `${base[0]}${suffix} in the news`,
      jobId: MAIN_JOB_ID,
      articleId: 71360 + i,
    });
  }
  return [...named, ...generated].map(toRow);
}

/** Which job a fixture signal belongs to (by row id). */
export function signalJobId(row: SignalRow): string {
  const index = row.id - 9000;
  const seed = index < named.length ? named[index] : undefined;
  return seed?.jobId ?? MAIN_JOB_ID;
}
