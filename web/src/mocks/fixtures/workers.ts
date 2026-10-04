/** The 8 workers of mockup-spec §4.7 and 14 days of daily stats (§4.8 shapes). */
import type { DailyStats } from "@/api/types/stats";
import type { Worker } from "@/api/types/workers";
import { dateDaysAgo, daysAgo, minutesAgo, secondsAgo } from "./clock";

interface WorkerSeed {
  instance: string;
  role: string;
  startedAt: string;
  heartbeatAge: number;
  tasks: number[];
  proxy: boolean | null;
}

const seeds: WorkerSeed[] = [
  {
    instance: "api-1",
    role: "api",
    startedAt: daysAgo(1, 22, 10),
    heartbeatAge: 2,
    tasks: [],
    proxy: null,
  },
  {
    instance: "maintenance-1",
    role: "maintenance",
    startedAt: daysAgo(1, 22, 10),
    heartbeatAge: 4,
    tasks: [],
    proxy: null,
  },
  {
    instance: "finder-1",
    role: "finder",
    startedAt: daysAgo(1, 22, 10),
    heartbeatAge: 3,
    tasks: [],
    proxy: true,
  },
  {
    instance: "sections-1",
    role: "sections",
    startedAt: daysAgo(1, 22, 10),
    heartbeatAge: 6,
    tasks: [48816],
    proxy: true,
  },
  {
    instance: "discovery-1",
    role: "discovery",
    startedAt: daysAgo(1, 22, 10),
    heartbeatAge: 1,
    tasks: [48840],
    proxy: true,
  },
  {
    instance: "discovery-2",
    role: "discovery",
    startedAt: daysAgo(0, 10, 52),
    heartbeatAge: 2,
    tasks: [48818],
    proxy: true,
  },
  {
    instance: "analysis-1",
    role: "analysis",
    startedAt: daysAgo(1, 22, 10),
    heartbeatAge: 5,
    tasks: [48915, 48931],
    proxy: null,
  },
  {
    instance: "analysis-2",
    role: "analysis",
    startedAt: daysAgo(1, 22, 10),
    heartbeatAge: 47,
    tasks: [48911, 48932],
    proxy: null,
  },
];

export function buildWorkerFixtures(): Worker[] {
  return seeds.map((s) => ({
    instance_id: s.instance,
    role: s.role,
    hostname: `pipeline-${s.role}`,
    version: "v2.1.0",
    started_at: s.startedAt,
    last_seen: secondsAgo(s.heartbeatAge),
    current_tasks: s.tasks,
    proxy_ok: s.proxy,
    proxy_checked_at: s.proxy === null ? null : minutesAgo(4),
    gone_at: null,
    live: true,
    heartbeat_age_seconds: s.heartbeatAge,
    running_tasks: s.tasks.length,
  }));
}

/** Deterministic pseudo-random in [0, 1) from a seed (no Math.random so snapshots stay stable). */
function noise(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

/** Signals per day follow the mockup sparkline shape (rising towards today). */
const SIGNAL_SHAPE = [7, 9, 8, 11, 10, 14, 12, 16, 11, 15, 19, 22, 24, 18];

export function buildDailyStatsFixtures(days = 14): DailyStats[] {
  const rows: DailyStats[] = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const n = noise(i + 1);
    const signals = SIGNAL_SHAPE[days - 1 - i] ?? 12;
    const articles = Math.round(signals * 2.4 + n * 6);
    const inputTokens = Math.round(articles * 23_000 + n * 50_000);
    const outputTokens = Math.round(inputTokens * 0.19);
    const cost = Number((inputTokens / 1e6) * 1.1 + (outputTokens / 1e6) * 4.4).toFixed(2);
    rows.push({
      day: dateDaysAgo(i),
      jobs: 2 + Math.round(n * 3),
      site_runs: 8 + Math.round(n * 10),
      articles,
      companies: Math.round(articles * 3.2),
      signals,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      cost_usd: Number(cost),
      known_cost_usd: Number(cost),
      unpriced_calls: 0,
      unknown_usage_calls: 0,
      cost_complete: true,
      failures:
        i % 4 === 0
          ? { model_rate_limited: 1 }
          : i % 5 === 0
            ? { saved_content_unavailable: 1, task_timeout: 1 }
            : {},
    });
  }
  return rows;
}
