/** The seed rows of the 9 jobs (mockup-spec §4.1); `buildJobFixtures` turns them into JobDetail rows. */
import type { JobCost, JobDetail, JobProgress } from "@/api/types/jobs";
import { daysAgo, minutesAgo } from "./clock";
import { BATCH_ID, JOB_IDS, MAIN_JOB_COSTS } from "./jobIds";

export interface JobSeed {
  id: string;
  kind: JobDetail["kind"];
  input: JobDetail["input"];
  county: string;
  state: string;
  status: JobDetail["status"];
  stopReason?: string;
  clientReference?: string;
  createdAt: string;
  startedAt?: string | null;
  durationSeconds?: number | null;
  progress: Partial<Omit<JobProgress, "job_id">>;
  /** Site runs finished so far (mockup §4.1 "Sites" column); the total is `progress.seeds`. */
  sitesDone?: number;
  costs?: JobCost[];
  costUsd?: number;
  tokens?: number;
  settings?: Record<string, unknown>;
}

export const JOB_SEEDS: JobSeed[] = [
  {
    id: JOB_IDS.orangeConstruction,
    sitesDone: 5,
    kind: "location_industry",
    input: { location: "Orlando, FL", industry: "Construction" },
    county: "Orange",
    state: "FL",
    status: "analysing",
    clientReference: "scout-7-2026-10-04",
    createdAt: minutesAgo(29),
    startedAt: minutesAgo(29),
    progress: {
      seeds: 5,
      sections: 11,
      pages: 99,
      links: 26_300,
      articles: 40,
      summaries: 31,
      companies: 139,
      signals: 24,
      tasks_pending: 10,
      tasks_running: 2,
      tasks_dead: 1,
    },
    costs: MAIN_JOB_COSTS,
  },
  {
    id: JOB_IDS.orangeManufacturing,
    sitesDone: 3,
    kind: "location_industry",
    input: { location: "Orlando, FL", industry: "Manufacturing" },
    county: "Orange",
    state: "FL",
    status: "discovering",
    clientReference: `ui:${BATCH_ID}:manufacturing`,
    createdAt: minutesAgo(29),
    startedAt: minutesAgo(29),
    progress: {
      seeds: 5,
      sections: 7,
      pages: 31,
      links: 8_900,
      articles: 12,
      summaries: 0,
      companies: 0,
      signals: 3,
      tasks_pending: 6,
      tasks_running: 2,
    },
    costUsd: 0.86,
    tokens: 410_000,
  },
  {
    id: JOB_IDS.orangeWholesale,
    sitesDone: 0,
    kind: "location_industry",
    input: { location: "Orlando, FL", industry: "Wholesale Trade" },
    county: "Orange",
    state: "FL",
    status: "exploring",
    clientReference: `ui:${BATCH_ID}:wholesale-trade`,
    createdAt: minutesAgo(29),
    startedAt: minutesAgo(29),
    progress: { seeds: 5, sections: 0, tasks_pending: 5, tasks_running: 1 },
    costUsd: 0.21,
    tokens: 96_000,
  },
  {
    id: JOB_IDS.jeffersonConstruction,
    sitesDone: 2,
    kind: "seeds",
    input: {
      seeds: [
        { title: "Range Wire", url: "https://rangewire.com" },
        { title: "Denverite", url: "https://denverite.com" },
        { title: "Lakewood Sentinel", url: "https://lakewoodsentinel.com" },
        { title: "Golden Transcript", url: "https://goldentranscript.net" },
      ],
    },
    county: "Jefferson",
    state: "CO",
    status: "discovering",
    createdAt: minutesAgo(43),
    startedAt: minutesAgo(43),
    progress: {
      seeds: 4,
      sections: 9,
      pages: 54,
      links: 12_400,
      articles: 17,
      summaries: 6,
      companies: 21,
      signals: 6,
      tasks_pending: 4,
      tasks_running: 2,
    },
    costUsd: 1.04,
    tokens: 530_000,
  },
  {
    id: JOB_IDS.harrisManufacturingQueued,
    kind: "location_industry",
    input: { location: "Houston, TX", industry: "Manufacturing" },
    county: "Harris",
    state: "TX",
    status: "queued",
    createdAt: minutesAgo(2),
    startedAt: null,
    progress: { tasks_pending: 1 },
  },
  {
    id: JOB_IDS.maricopaRetail,
    sitesDone: 3,
    kind: "seeds",
    input: {
      seeds: [
        { title: "Sonoran Post", url: "https://sonoranpost.com" },
        { title: "Phoenix Business Ledger", url: "https://phxledger.com" },
        { title: "East Valley Tribune", url: "https://eastvalleytribune.com" },
      ],
    },
    county: "Maricopa",
    state: "AZ",
    status: "partial",
    stopReason: "site_time_limit",
    createdAt: daysAgo(1, 16, 10),
    startedAt: daysAgo(1, 16, 10),
    durationSeconds: 72 * 60,
    progress: {
      seeds: 3,
      sections: 8,
      pages: 61,
      links: 14_200,
      articles: 22,
      summaries: 22,
      companies: 48,
      signals: 9,
    },
    costUsd: 1.9,
    tokens: 980_000,
  },
  {
    id: JOB_IDS.fultonWholesale,
    sitesDone: 5,
    kind: "location_industry",
    input: { location: "Atlanta, GA", industry: "Wholesale Trade" },
    county: "Fulton",
    state: "GA",
    status: "completed",
    createdAt: daysAgo(2, 9, 30),
    startedAt: daysAgo(2, 9, 30),
    durationSeconds: 54 * 60,
    progress: {
      seeds: 5,
      sections: 12,
      pages: 88,
      links: 21_700,
      articles: 35,
      summaries: 35,
      companies: 77,
      signals: 18,
    },
    costUsd: 2.74,
    tokens: 1_410_000,
  },
  {
    id: JOB_IDS.cookUtilities,
    sitesDone: 0,
    kind: "location_industry",
    input: { location: "Chicago, IL", industry: "Utilities" },
    county: "Cook",
    state: "IL",
    status: "failed",
    stopReason: "no_sources_found",
    createdAt: daysAgo(3, 14, 5),
    startedAt: daysAgo(3, 14, 5),
    durationSeconds: 4 * 60,
    progress: {},
    costUsd: 0.09,
    tokens: 41_000,
  },
  {
    id: JOB_IDS.harrisManufacturingEarlier,
    sitesDone: 5,
    kind: "location_industry",
    input: { location: "Houston, TX", industry: "Manufacturing" },
    county: "Harris",
    state: "TX",
    status: "completed",
    createdAt: daysAgo(2, 7, 15),
    startedAt: daysAgo(2, 7, 15),
    durationSeconds: 61 * 60,
    progress: {
      seeds: 5,
      sections: 10,
      pages: 72,
      links: 18_900,
      articles: 29,
      summaries: 29,
      companies: 63,
      signals: 14,
    },
    costUsd: 2.31,
    tokens: 1_190_000,
  },
];
