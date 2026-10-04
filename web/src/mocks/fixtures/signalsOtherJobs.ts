/**
 * Deterministic signal seeds for the jobs other than the main one, so every job's Signals tab
 * holds exactly `progress.signals` rows and the explorer can merge them (mockup §3.8).
 */
import { JOB_IDS } from "./jobIds";
import { JOB_SEEDS } from "./jobSeeds";
import type { SignalSeed } from "./signalSeeds";

interface JobPool {
  jobId: string;
  state: string;
  industry: string;
  subIndustries: readonly string[];
  domains: readonly string[];
  /** `[name, city, industry?, subIndustry?]` — the overrides let a company keep its own sector. */
  companies: readonly [name: string, city: string, industry?: string, subIndustry?: string][];
}

const POOLS: readonly JobPool[] = [
  {
    jobId: JOB_IDS.orangeManufacturing,
    state: "FL",
    industry: "Manufacturing",
    subIndustries: ["Machine shops", "Fabricated metal products", "Composite materials"],
    domains: ["orlandosentinel.com", "bizjournals.com/orlando", "floridadaily.com"],
    companies: [
      ["Sanford Machine Works", "Sanford"],
      ["Taft Fabrication", "Taft"],
      ["Lakeview Builders Group", "Orlando", "Construction", "Nonresidential building (2362)"],
    ],
  },
  {
    jobId: JOB_IDS.jeffersonConstruction,
    state: "CO",
    industry: "Construction",
    subIndustries: ["Specialty trade contractors", "Highway and street", "Site preparation"],
    domains: ["rangewire.com", "denverite.com", "lakewoodsentinel.com", "goldentranscript.net"],
    companies: [
      ["Golden Ridge Contractors", "Golden"],
      ["Lakewood Paving", "Lakewood"],
      ["Arvada Steel Erectors", "Arvada"],
      ["Wheat Ridge Mechanical", "Wheat Ridge"],
      ["Evergreen Excavating", "Evergreen"],
    ],
  },
  {
    jobId: JOB_IDS.maricopaRetail,
    state: "AZ",
    industry: "Retail Trade",
    subIndustries: ["Grocery stores", "Home furnishings", "Sporting goods", "Garden centers"],
    domains: ["sonoranpost.com", "phxledger.com", "eastvalleytribune.com"],
    companies: [
      ["Desert Bloom Grocers", "Phoenix"],
      ["Mesa Outdoor Supply", "Mesa"],
      ["Chandler Home Goods", "Chandler"],
      ["Tempe Cycle Works", "Tempe"],
      ["Glendale Furniture Mart", "Glendale"],
      ["Scottsdale Boutique Group", "Scottsdale"],
      ["Gilbert Garden Center", "Gilbert"],
      ["Peoria Appliance Outlet", "Peoria"],
    ],
  },
  {
    jobId: JOB_IDS.fultonWholesale,
    state: "GA",
    industry: "Wholesale Trade",
    subIndustries: ["Grocery wholesale", "Durable goods", "Nondurable goods", "Medical supplies"],
    domains: ["peachreport.com", "atlantabusinesschronicle.com", "saportareport.com"],
    companies: [
      ["Atlanta Produce Partners", "Atlanta"],
      ["Buckhead Beverage Supply", "Atlanta"],
      ["Fulton Industrial Supply", "Atlanta"],
      ["Georgia Paper Wholesale", "East Point"],
      ["Midtown Medical Distributors", "Atlanta"],
      ["Southside Auto Parts Depot", "College Park"],
      ["East Point Electrical Wholesale", "East Point"],
      ["Peachtree Hills Foods", "Atlanta"],
      ["Westside Lumber Supply", "Atlanta"],
      ["College Park Logistics", "College Park"],
      ["Hapeville Packaging Supply", "Hapeville"],
      ["Sandy Springs Pharma Distribution", "Sandy Springs"],
      ["Chattahoochee Metals", "Atlanta"],
      ["Alpharetta Tech Distributors", "Alpharetta"],
      ["Roswell Grocery Wholesale", "Roswell"],
      ["Downtown Floral Wholesale", "Atlanta"],
      ["Cascade Building Supply", "Atlanta"],
    ],
  },
  {
    jobId: JOB_IDS.harrisManufacturingEarlier,
    state: "TX",
    industry: "Manufacturing",
    subIndustries: ["Petrochemical equipment", "Valves and fittings", "Plastics", "Machining"],
    domains: ["houstonledger.com", "houstonchronicle.com", "bizjournals.com/houston"],
    companies: [
      ["Pasadena Petrochem Fabricators", "Pasadena"],
      ["Baytown Valve Works", "Baytown"],
      ["Houston Precision Machining", "Houston"],
      ["Channelview Plastics", "Channelview"],
      ["La Porte Industrial Coatings", "La Porte"],
      ["Katy Food Processing", "Katy"],
      ["Deer Park Pipe & Tube", "Deer Park"],
      ["Spring Branch Electronics", "Houston"],
      ["Humble Metal Stampings", "Humble"],
      ["Cypress Composite Materials", "Cypress"],
      ["Pearland Pump Manufacturing", "Pearland"],
      ["Tomball Oilfield Equipment", "Tomball"],
    ],
  },
];

type Template = readonly [
  signal: string,
  materiality: SignalSeed["materiality"],
  evidence: (company: string, city: string) => string,
  title: (company: string, city: string) => string,
];

const TEMPLATES: readonly Template[] = [
  [
    "Mass Hiring",
    "High",
    (c, city) => `${c} plans to hire 80 workers at its ${city} facility over the next year.`,
    (c) => `${c} to add 80 jobs`,
  ],
  [
    "Operational Capacity Expansion",
    "High",
    (c, city) => `${c} is expanding its ${city} plant with a second production line.`,
    (c, city) => `${c} expands in ${city}`,
  ],
  [
    "New Office or Location Opening",
    "Medium",
    (c, city) => `${c} opened a new location on Main Street in ${city} this week.`,
    (c, city) => `${c} opens ${city} location`,
  ],
  [
    "Major Contract Awarded",
    "High",
    (c, city) => `${c} won a $12 million contract for the ${city} civic center project.`,
    (c) => `${c} lands civic center contract`,
  ],
  [
    "Closed Deal",
    "Medium",
    (c, city) => `${c} closed on a 4-acre site in ${city} for $3.2 million.`,
    (c, city) => `${city} parcel sells to ${c}`,
  ],
  [
    "Groundbreaking Ceremony",
    "Medium",
    (c, city) => `${c} broke ground on its new ${city} headquarters on Thursday.`,
    (c) => `${c} breaks ground on headquarters`,
  ],
  [
    "Capital Raise",
    "High",
    (c) => `${c} closed a $9 million growth round led by a regional bank's venture arm.`,
    (c) => `${c} raises $9M`,
  ],
  [
    "Industry Award or Recognition",
    "Low",
    (c, city) => `${c} was named ${city} business of the year by the local chamber.`,
    (c) => `Chamber honours ${c}`,
  ],
  [
    "New Product or Service Launch",
    "Medium",
    (c) => `${c} launched a same-day delivery service for commercial customers.`,
    (c) => `${c} launches same-day delivery`,
  ],
  [
    "Leadership Changes",
    "Low",
    (c) => `${c} named a new chief operating officer after a six-month search.`,
    (c) => `${c} names new COO`,
  ],
  [
    "New Partnership",
    "Medium",
    (c, city) => `${c} signed a supply partnership with the ${city} school district.`,
    (c) => `${c} signs district partnership`,
  ],
  [
    "Project Completion",
    "Low",
    (c, city) => `${c} completed the ${city} distribution center ahead of schedule.`,
    (_c, city) => `${city} distribution center completed`,
  ],
];

const REVENUE_BINS = ["$1M-$10M", "$10M-$20M", "$20M-$50M", "$50M-$100M", "<$1M", "unknown"];

function targetCount(jobId: string): number {
  return JOB_SEEDS.find((seed) => seed.id === jobId)?.progress.signals ?? 0;
}

/**
 * Generated seeds for every pool, `progress.signals − named rows` per job, in a fixed order so
 * mention ids, dates and companies never change between runs.
 */
export function buildOtherJobSeeds(namedOthers: readonly SignalSeed[]): SignalSeed[] {
  const seeds: SignalSeed[] = [];
  let sequence = 0;
  for (const pool of POOLS) {
    const named = namedOthers.filter((seed) => seed.jobId === pool.jobId).length;
    const wanted = Math.max(0, targetCount(pool.jobId) - named);
    for (let i = 0; i < wanted; i += 1) {
      const [company, city, industry, subIndustry] = pool.companies[i % pool.companies.length]!;
      const template = TEMPLATES[(sequence + i) % TEMPLATES.length]!;
      const [signal, materiality, evidence, title] = template;
      const suffix =
        i >= pool.companies.length ? ` ${Math.floor(i / pool.companies.length) + 1}` : "";
      const name = `${company}${suffix}`;
      seeds.push({
        company: name,
        org: "business",
        signal,
        materiality,
        confidence: Number((0.7 + ((sequence * 7 + i * 3) % 26) / 100).toFixed(2)),
        evidence: evidence(name, city),
        city,
        scope: i % 4 === 3 ? "state" : "local",
        state: pool.state,
        industry: industry ?? pool.industry,
        subIndustry: subIndustry ?? pool.subIndustries[i % pool.subIndustries.length]!,
        revenue: REVENUE_BINS[(sequence + i) % REVENUE_BINS.length]!,
        daysAgo: 3 + ((sequence * 5 + i * 3) % 12),
        domain: pool.domains[i % pool.domains.length]!,
        title: title(name, city),
        jobId: pool.jobId,
        articleId: 72_000 + sequence + i,
      });
    }
    sequence += wanted;
  }
  return seeds;
}
