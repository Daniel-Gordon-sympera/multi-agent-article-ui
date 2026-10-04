/** The 5 site runs of the main job (mockup-spec §4.2). */
import type { SiteRun } from "@/api/types/siteRuns";
import { addSeconds, minutesAgo } from "./clock";
import { MAIN_JOB_ID } from "./jobs";

export const SITE_RUN_IDS = {
  orlandoMagazine: "5e1a2b3c-0001-4b00-9000-000000000101",
  orlandoSentinel: "5e1a2b3c-0002-4b00-9000-000000000102",
  bizJournals: "5e1a2b3c-0003-4b00-9000-000000000103",
  orlandoWeekly: "5e1a2b3c-0004-4b00-9000-000000000104",
  growthSpotter: "5e1a2b3c-0005-4b00-9000-000000000105",
} as const;

const MB = 1024 * 1024;
const jobStart = minutesAgo(29);

interface SiteRunSeed {
  id: string;
  domain: string;
  title: string;
  rank: number;
  status: SiteRun["status"];
  sections: number;
  pages: number;
  articles: number;
  bytes: number;
  stopReason: string | null;
  startOffsetSeconds: number;
  durationSeconds: number | null;
  candidates: number;
  accepted: number;
}

const seeds: SiteRunSeed[] = [
  {
    id: SITE_RUN_IDS.orlandoMagazine,
    domain: "orlandomagazine.com",
    title: "Orlando Magazine",
    rank: 1,
    status: "finished",
    sections: 4,
    pages: 38,
    articles: 18,
    bytes: 21.4 * MB,
    stopReason: "no_new_accepted_articles",
    startOffsetSeconds: 8 * 60,
    durationSeconds: 27 * 60,
    candidates: 142,
    accepted: 18,
  },
  {
    id: SITE_RUN_IDS.orlandoSentinel,
    domain: "orlandosentinel.com",
    title: "Orlando Sentinel",
    rank: 2,
    status: "finished",
    sections: 3,
    pages: 31,
    articles: 14,
    bytes: 19.8 * MB,
    stopReason: "no_new_accepted_articles",
    startOffsetSeconds: 8 * 60 + 5,
    durationSeconds: 24 * 60,
    candidates: 131,
    accepted: 14,
  },
  {
    id: SITE_RUN_IDS.bizJournals,
    domain: "bizjournals.com/orlando",
    title: "Orlando Business Journal",
    rank: 3,
    status: "partial",
    sections: 2,
    pages: 19,
    articles: 6,
    bytes: 9.1 * MB,
    stopReason: "site_time_limit",
    startOffsetSeconds: 9 * 60 + 31,
    durationSeconds: 30 * 60,
    candidates: 77,
    accepted: 6,
  },
  {
    id: SITE_RUN_IDS.orlandoWeekly,
    domain: "orlandoweekly.com",
    title: "Orlando Weekly",
    rank: 4,
    status: "no_sections",
    sections: 0,
    pages: 0,
    articles: 0,
    bytes: 0.3 * MB,
    stopReason: "no_sections",
    startOffsetSeconds: 4 * 60 + 8,
    durationSeconds: 3 * 60 + 5,
    candidates: 0,
    accepted: 0,
  },
  {
    id: SITE_RUN_IDS.growthSpotter,
    domain: "growthspotter.com",
    title: "GrowthSpotter",
    rank: 5,
    status: "finished",
    sections: 2,
    pages: 11,
    articles: 2,
    bytes: 6.2 * MB,
    stopReason: "no_new_accepted_articles",
    startOffsetSeconds: 10 * 60,
    durationSeconds: 22 * 60,
    candidates: 46,
    accepted: 2,
  },
];

export function buildSiteRunFixtures(): SiteRun[] {
  return seeds.map((s) => {
    const startedAt = addSeconds(jobStart, s.startOffsetSeconds);
    return {
      id: s.id,
      job_id: MAIN_JOB_ID,
      seed_url: `https://${s.domain}`,
      domain: s.domain,
      title: s.title,
      rank: s.rank,
      status: s.status,
      stop_reason: s.stopReason,
      started_at: startedAt,
      finished_at: s.durationSeconds === null ? null : addSeconds(startedAt, s.durationSeconds),
      stats: {
        sections: s.sections,
        pages: s.pages,
        links: s.pages * 265,
        articles: s.articles,
        fetches: s.pages + s.articles,
        bytes: Math.round(s.bytes),
        tokens: s.pages * 4100,
        candidates: s.candidates,
        accepted: s.accepted,
      },
    };
  });
}
