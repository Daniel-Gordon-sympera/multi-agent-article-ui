import { defaultSettings } from "./jobSettings";
/**
 * The 9 jobs of mockup-spec §4.1 with stable ids (the main job is
 * `0192f1c2-7e0a-4c1b-9d33-5a1e8b2f0c41`; the others keep their 8-char prefix).
 */
import type { JobDetail, JobProgress } from "@/api/types/jobs";
import { addSeconds } from "./clock";
import { PROMPT_VERSION, cost } from "./jobIds";
import { JOB_SEEDS as seeds, type JobSeed } from "./jobSeeds";

export {
  BATCH_ID,
  JOB_IDS,
  MAIN_JOB_COSTS,
  MAIN_JOB_ID,
  PROMPT_VERSION,
  SCOUT_IDS,
} from "./jobIds";

const progress = (id: string, p: Partial<JobProgress>): JobProgress => ({
  job_id: id,
  seeds: 0,
  sections: 0,
  pages: 0,
  links: 0,
  articles: 0,
  summaries: 0,
  companies: 0,
  signals: 0,
  tasks_pending: 0,
  tasks_running: 0,
  tasks_dead: 0,
  ...p,
});

function summaryFor(seed: JobSeed, finishedAt: string | null): JobDetail["summary"] {
  if (!["completed", "partial", "failed", "cancelled"].includes(seed.status)) return null;
  const p = seed.progress;
  return {
    job_id: seed.id,
    prompt_version: PROMPT_VERSION,
    status: seed.status,
    seeds: p.seeds ?? 0,
    sources: (p.seeds ?? 0) * 4,
    site_ranking: (p.seeds ?? 0) * 3,
    chosen_seeds: p.seeds ?? 0,
    sections: p.sections ?? 0,
    pages: p.pages ?? 0,
    links: p.links ?? 0,
    articles: p.articles ?? 0,
    summaries: p.summaries ?? 0,
    companies: p.companies ?? 0,
    signals: p.signals ?? 0,
    company_flags: p.companies ?? 0,
    started_at: seed.startedAt ?? null,
    finished_at: finishedAt,
    duration_seconds: seed.durationSeconds ?? null,
    cumulative_duration_seconds: seed.durationSeconds ?? null,
    session_count: 1,
    sessions: seed.startedAt ? [{ started_at: seed.startedAt, ended_at: finishedAt }] : [],
    stop_reason: seed.stopReason ?? null,
    stop_reasons: seed.stopReason ? [seed.stopReason] : [],
    stopped_early: seed.status === "partial",
    stopped_reason: seed.stopReason ?? null,
    failures: [],
    input_tokens: Math.round((seed.tokens ?? 0) * 0.82),
    output_tokens: Math.round((seed.tokens ?? 0) * 0.18),
    total_tokens: seed.tokens ?? 0,
    cumulative_total_tokens: seed.tokens ?? 0,
    all_services_input_tokens: Math.round((seed.tokens ?? 0) * 0.82),
    all_services_output_tokens: Math.round((seed.tokens ?? 0) * 0.18),
    all_services_total_tokens: seed.tokens ?? 0,
    usage_by_stage: null,
    usage_basis: "ledger",
    cost_usd: seed.costUsd ?? 0,
    known_cost_usd: seed.costUsd ?? 0,
    unpriced_calls: 0,
    cost_complete: true,
  };
}

function buildJob(seed: JobSeed): JobDetail {
  const finishedAt =
    seed.startedAt && seed.durationSeconds !== undefined && seed.durationSeconds !== null
      ? addSeconds(seed.startedAt, seed.durationSeconds)
      : null;
  const costs =
    seed.costs ??
    (seed.costUsd
      ? [
          cost(
            seed.id,
            "classification",
            Math.round((seed.tokens ?? 0) / 4200),
            Math.round((seed.tokens ?? 0) * 0.4),
            seed.costUsd * 0.4,
          ),
          cost(
            seed.id,
            "summary",
            Math.round((seed.tokens ?? 0) / 9000),
            Math.round((seed.tokens ?? 0) * 0.35),
            seed.costUsd * 0.35,
          ),
          cost(
            seed.id,
            "company_pass",
            Math.round((seed.tokens ?? 0) / 7500),
            Math.round((seed.tokens ?? 0) * 0.15),
            seed.costUsd * 0.15,
          ),
          cost(
            seed.id,
            "sections_agent",
            seed.progress.seeds ?? 0,
            Math.round((seed.tokens ?? 0) * 0.1),
            seed.costUsd * 0.1,
          ),
        ]
      : []);
  return {
    id: seed.id,
    kind: seed.kind,
    input: seed.input,
    county: seed.county,
    state_code: seed.state,
    settings: { ...defaultSettings, ...seed.settings },
    prompt_version: PROMPT_VERSION,
    status: seed.status,
    stop_reason: seed.stopReason ?? null,
    client_reference: seed.clientReference ?? null,
    created_by: "daniel-ops",
    created_at: seed.createdAt,
    started_at: seed.startedAt ?? null,
    deadline_at: seed.startedAt ? addSeconds(seed.startedAt, defaultSettings.max_runtime) : null,
    finished_at: finishedAt,
    summary: summaryFor(seed, finishedAt),
    sessions: seed.startedAt ? [{ started_at: seed.startedAt, ended_at: finishedAt }] : [],
    progress: progress(seed.id, seed.progress),
    costs,
  };
}

export function buildJobFixtures(): JobDetail[] {
  return seeds.map(buildJob);
}

export interface JobSiteCounts {
  done: number;
  total: number;
}

/** "Sites done / total" of the fixture jobs (mockup §4.1), served by `/app/jobs/progress`. */
export function buildJobSiteCounts(): Record<string, JobSiteCounts> {
  const counts: Record<string, JobSiteCounts> = {};
  for (const seed of seeds) {
    if (seed.sitesDone === undefined) continue;
    counts[seed.id] = { done: seed.sitesDone, total: seed.progress.seeds ?? 0 };
  }
  return counts;
}
