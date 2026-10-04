/**
 * Operations rows of the main job: sections, finder sources/ranking and events, generated from
 * the site-run and task fixtures.
 */
import type { PipelineEvent } from "@/api/types/events";
import type { FinderSourceRow, RankingRow } from "@/api/types/finder";
import type { SectionRow } from "@/api/types/sections";
import type { SiteRun } from "@/api/types/siteRuns";
import type { Task } from "@/api/types/tasks";
import { addSeconds, minutesAgo } from "./clock";
import { MAIN_JOB_ID } from "./jobs";

const SEARCH_ID = "9c8b7a6d-0001-4c00-a000-000000000201";
const jobStart = minutesAgo(29);

const SECTION_NAMES = [
  "Business",
  "Real Estate",
  "Development",
  "Local News",
  "Economy",
  "Construction",
  "Growth",
  "Politics",
  "Sports",
  "Opinion",
  "Dining",
  "Events",
  "Obituaries",
];

export function buildSections(siteRuns: SiteRun[]): SectionRow[] {
  const rows: SectionRow[] = [];
  let id = 2000;
  for (const run of siteRuns) {
    const kept = run.stats.sections ?? 0;
    const total = kept + 4;
    for (let i = 0; i < total; i += 1) {
      const name = SECTION_NAMES[(i + run.rank!) % SECTION_NAMES.length]!;
      const isKept = i < kept;
      rows.push({
        id,
        site_run_id: run.id,
        section_id: isKept ? i + 1 : null,
        domain: run.domain,
        url: `https://${run.domain}/${name.toLowerCase().replace(/\s+/g, "-")}`,
        canonical_url: `https://${run.domain}/${name.toLowerCase().replace(/\s+/g, "-")}`,
        title: name,
        kind: "section",
        kept: isKept,
        reason: isKept ? "business coverage with dated articles" : "no local business relevance",
        origin: run.rank === 1 ? "memory" : "agent",
        recorded_at: addSeconds(run.started_at ?? jobStart, 60 + i * 15),
      });
      id += 1;
    }
  }
  return rows;
}

const JUDGED = [
  "orlandomagazine.com",
  "orlandosentinel.com",
  "bizjournals.com/orlando",
  "orlandoweekly.com",
  "growthspotter.com",
  "floridadaily.com",
  "westorlandonews.com",
  "clickorlando.com",
  "wesh.com",
  "orlandobusinessjournal.com",
  "flapol.com",
  "floridatrend.com",
  "wftv.com",
  "fox35orlando.com",
  "mynews13.com",
  "theorlandoadvocate.com",
  "orlandoinsider.com",
  "ocfl.net",
  "orlandoeconomic.com",
  "cfnews13.com",
  "visitorlando.com",
  "yelp.com",
  "tripadvisor.com",
];

export function buildFinderSources(): FinderSourceRow[] {
  return JUDGED.map((domain, i) => ({
    search_id: SEARCH_ID,
    domain,
    name: domain.split(".")[0] ?? domain,
    url: `https://${domain}`,
    coverage: i < 5 ? "local" : i < 12 ? "state" : "national",
    relevance: i < 7 ? "high" : i < 15 ? "medium" : "low",
    reason: i < 15 ? "Local business and development coverage" : "Not a news source",
    verdict: i < 15 ? "accept" : "reject",
    origin: i % 4 === 0 ? "memory" : "judge",
    round: 1 + (i % 3),
    source_order: i + 1,
    created_at: addSeconds(jobStart, 60 + i * 4),
  }));
}

export function buildRanking(): RankingRow[] {
  return JUDGED.slice(0, 15).map((domain, i) => ({
    search_id: SEARCH_ID,
    tier: i < 5 ? "high" : i < 10 ? "medium" : "low",
    tier_rank: (i % 5) + 1,
    overall_rank: i + 1,
    url: `https://${domain}`,
    name: domain.split(".")[0] ?? domain,
    reason: i < 5 ? "Frequent, dated local business articles" : "Occasional coverage",
    pages_opened: 3,
    coverage: i < 5 ? "local" : "state",
    relevance: i < 7 ? "high" : "medium",
    finder_reason: "Local business and development coverage",
    chosen: i < 5,
  }));
}

export function buildEvents(tasks: Task[], siteRuns: SiteRun[]): PipelineEvent[] {
  const events: PipelineEvent[] = [];
  let id = 80_000;
  for (const task of tasks) {
    if (!task.started_at) continue;
    events.push({
      id: id++,
      ts: task.started_at,
      job_id: MAIN_JOB_ID,
      site_run_id: task.site_run_id,
      task_id: task.id,
      service: task.kind.split("_")[0] ?? "platform",
      event: "task_claimed",
      stage: task.kind,
      url: null,
      status: "running",
      error_category: null,
      duration_ms: null,
      attrs: { worker: task.claimed_by },
    });
    if (task.finished_at) {
      events.push({
        id: id++,
        ts: task.finished_at,
        job_id: MAIN_JOB_ID,
        site_run_id: task.site_run_id,
        task_id: task.id,
        service: task.kind.split("_")[0] ?? "platform",
        event: "task_finished",
        stage: task.kind,
        url: null,
        status: task.status === "dead" ? "failed" : task.status,
        error_category: task.error_category,
        duration_ms:
          (new Date(task.finished_at).getTime() - new Date(task.started_at).getTime()) | 0,
        attrs: {},
      });
    }
  }
  for (const run of siteRuns) {
    events.push(...fetchEvents(run, id));
    id += FETCH_EVENTS_PER_RUN;
    if (!run.finished_at) continue;
    events.push({
      id: id++,
      ts: run.finished_at,
      job_id: MAIN_JOB_ID,
      site_run_id: run.id,
      task_id: null,
      service: "discovery",
      event: "site_result",
      stage: "discovering",
      url: run.seed_url,
      status: run.status,
      error_category: run.stop_reason,
      duration_ms:
        (new Date(run.finished_at).getTime() -
          new Date(run.started_at ?? run.finished_at).getTime()) |
        0,
      attrs: { bytes: run.stats.bytes ?? 0, pages: run.stats.pages ?? 0 },
    });
  }
  return events.sort((a, b) => a.ts.localeCompare(b.ts) || a.id - b.id);
}

const FETCH_EVENTS_PER_RUN = 10;

/** Page fetches and accepted articles of one site run (the bulk of a job's event log). */
function fetchEvents(run: SiteRun, firstId: number): PipelineEvent[] {
  const started = run.started_at ?? jobStart;
  const pages = run.stats.pages ?? 0;
  const events: PipelineEvent[] = [];
  for (let i = 0; i < FETCH_EVENTS_PER_RUN; i += 1) {
    const page = i % 2 === 0;
    const failed = pages > 0 && i === 7;
    events.push({
      id: firstId + i,
      ts: addSeconds(started, 90 + i * 45),
      job_id: MAIN_JOB_ID,
      site_run_id: run.id,
      task_id: null,
      service: page ? "discovery" : "analysis",
      event: pages === 0 ? "section_skipped" : page ? "page_fetched" : "article_accepted",
      stage: pages === 0 ? "exploring" : "discovering",
      url: `${run.seed_url}/${page ? "business/page" : "story"}/${i + 1}`,
      status: failed ? "failed" : "ok",
      error_category: failed ? "network_error" : null,
      duration_ms: failed ? 30_000 : 420 + i * 37,
      attrs: failed
        ? { attempt: 2, reason: "connection reset by peer" }
        : { bytes: 48_000 + i * 1_200, status_code: 200, links: page ? 24 + i : 0 },
    });
  }
  return events;
}
