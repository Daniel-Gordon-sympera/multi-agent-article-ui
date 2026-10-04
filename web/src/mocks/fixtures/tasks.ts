/** The 12 tasks of the main job in tree order (mockup-spec §4.3), with `parent_task_id`. */
import type { Task } from "@/api/types/tasks";
import { addSeconds, inSeconds, minutesAgo } from "./clock";
import { MAIN_JOB_ID } from "./jobs";
import { SITE_RUN_IDS } from "./siteRuns";

const jobStart = minutesAgo(29);
const at = (offsetSeconds: number) => addSeconds(jobStart, offsetSeconds);

interface TaskSeed {
  id: number;
  kind: string;
  parent: number | null;
  siteRun?: string;
  target: string;
  payload?: Record<string, unknown>;
  status: Task["status"];
  attempts: number;
  maxAttempts: number;
  worker: string | null;
  startOffset: number | null;
  duration: number | null;
  lastError?: string;
  errorCategory?: string;
  result?: Record<string, unknown>;
  runAfter?: string;
}

const seeds: TaskSeed[] = [
  {
    id: 48811,
    kind: "find_sources",
    parent: null,
    target: "Orlando, FL · Construction",
    status: "succeeded",
    attempts: 1,
    maxAttempts: 2,
    worker: "finder-1",
    startOffset: 4,
    duration: 131,
    result: { queries: 14, domains_judged: 23, kept: 5 },
  },
  {
    id: 48812,
    kind: "rank_sites",
    parent: 48811,
    target: "23 kept domains",
    status: "succeeded",
    attempts: 1,
    maxAttempts: 2,
    worker: "finder-1",
    startOffset: 135,
    duration: 108,
    result: { ranked: 23, chosen: 5 },
  },
  {
    id: 48813,
    kind: "explore_site",
    parent: 48812,
    siteRun: SITE_RUN_IDS.orlandoMagazine,
    target: "orlandomagazine.com",
    status: "succeeded",
    attempts: 1,
    maxAttempts: 2,
    worker: "sections-1",
    startOffset: 243,
    duration: 242,
    result: { kept: 4, skipped: 9 },
  },
  {
    id: 48817,
    kind: "discover_site",
    parent: 48813,
    siteRun: SITE_RUN_IDS.orlandoMagazine,
    target: "orlandomagazine.com",
    status: "succeeded",
    attempts: 1,
    maxAttempts: 3,
    worker: "discovery-1",
    startOffset: 489,
    duration: 1634,
    result: { pages: 38, articles: 18 },
  },
  {
    id: 48902,
    kind: "analyze_article",
    parent: 48817,
    siteRun: SITE_RUN_IDS.orlandoMagazine,
    target: "#71334 · Kirkman Road logistics hub clears final approval",
    payload: { article_id: 71334 },
    status: "succeeded",
    attempts: 1,
    maxAttempts: 4,
    worker: "analysis-1",
    startOffset: 1180,
    duration: 38,
    result: { companies: 3, signals: 1 },
  },
  {
    id: 48911,
    kind: "analyze_article",
    parent: 48817,
    siteRun: SITE_RUN_IDS.orlandoMagazine,
    target: "#71341 · Apopka plant expansion to add 40 jobs",
    payload: { article_id: 71341 },
    status: "running",
    attempts: 1,
    maxAttempts: 4,
    worker: "analysis-2",
    startOffset: 1740 - 41,
    duration: null,
  },
  {
    id: 48915,
    kind: "analyze_article",
    parent: 48817,
    siteRun: SITE_RUN_IDS.orlandoMagazine,
    target: "#71345 · Steel fabricator plans hiring push",
    payload: { article_id: 71345 },
    status: "failed",
    attempts: 2,
    maxAttempts: 4,
    worker: "analysis-1",
    startOffset: 1630,
    duration: null,
    lastError: "model_rate_limited · DeepSeek 429 after 3 calls",
    errorCategory: "model_rate_limited",
    runAfter: inSeconds(42),
  },
  {
    id: 48920,
    kind: "analyze_article",
    parent: 48817,
    siteRun: SITE_RUN_IDS.orlandoMagazine,
    target: "#71352 · County weighs impact fee increase",
    payload: { article_id: 71352 },
    status: "dead",
    attempts: 4,
    maxAttempts: 4,
    worker: "analysis-2",
    startOffset: 1473,
    duration: 12,
    lastError: "saved_content_unavailable · text artifact 410 (expired)",
    errorCategory: "saved_content_unavailable",
  },
  {
    id: 48814,
    kind: "explore_site",
    parent: 48812,
    siteRun: SITE_RUN_IDS.bizJournals,
    target: "bizjournals.com/orlando",
    status: "succeeded",
    attempts: 1,
    maxAttempts: 2,
    worker: "sections-1",
    startOffset: 245,
    duration: 320,
    result: { kept: 2, skipped: 11 },
  },
  {
    id: 48818,
    kind: "discover_site",
    parent: 48814,
    siteRun: SITE_RUN_IDS.bizJournals,
    target: "bizjournals.com/orlando",
    status: "succeeded",
    attempts: 1,
    maxAttempts: 3,
    worker: "discovery-2",
    startOffset: 571,
    duration: 1800,
    lastError: "site_time_limit",
    errorCategory: "site_time_limit",
    result: { partial: true, stop_reason: "site_time_limit", pages: 19, articles: 6 },
  },
  {
    id: 48816,
    kind: "explore_site",
    parent: 48812,
    siteRun: SITE_RUN_IDS.orlandoWeekly,
    target: "orlandoweekly.com",
    status: "succeeded",
    attempts: 1,
    maxAttempts: 2,
    worker: "sections-1",
    startOffset: 248,
    duration: 185,
    lastError: "no_sections · business no-op",
    errorCategory: "no_sections",
    result: { rejected: true, reason: "no_sections" },
  },
  {
    id: 48930,
    kind: "finalize_job",
    parent: null,
    target: "waiting for 9 pending tasks",
    status: "queued",
    attempts: 0,
    maxAttempts: 5,
    worker: null,
    startOffset: null,
    duration: null,
  },
];

export function buildTaskFixtures(): Task[] {
  return seeds.map((s) => {
    const startedAt = s.startOffset === null ? null : at(s.startOffset);
    const finishedAt =
      startedAt && s.duration !== null && s.status !== "running"
        ? addSeconds(startedAt, s.duration)
        : null;
    return {
      id: s.id,
      kind: s.kind,
      payload: { target: s.target, ...(s.payload ?? {}) },
      job_id: MAIN_JOB_ID,
      site_run_id: s.siteRun ?? null,
      parent_task_id: s.parent,
      dedupe_key: `${MAIN_JOB_ID}:${s.kind}:${s.target}`,
      status: s.status,
      priority: s.kind === "finalize_job" ? -1 : 0,
      run_after: s.runAfter ?? jobStart,
      attempts: s.attempts,
      max_attempts: s.maxAttempts,
      lease_until: s.status === "running" ? inSeconds(55) : null,
      claimed_by: s.worker,
      last_error: s.lastError ?? null,
      error_category: s.errorCategory ?? null,
      result: s.result ?? null,
      created_at: at(Math.max(0, (s.startOffset ?? 1700) - 2)),
      started_at: startedAt,
      finished_at: finishedAt,
    };
  });
}
