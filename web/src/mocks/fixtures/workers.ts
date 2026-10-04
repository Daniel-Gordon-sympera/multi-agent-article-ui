/**
 * The 8 workers of mockup-spec §4.7 (analysis-2 with a slow heartbeat). `heartbeat_age_seconds`
 * is the seed; the `/v1/workers` handler re-bases `last_seen` on every request so the ages stay
 * true however long the mock session runs. Daily stats moved to `./stats` (re-exported here so
 * `db.ts` keeps its import).
 */
import type { Worker } from "@/api/types/workers";
import { daysAgo, minutesAgo, secondsAgo } from "./clock";

export { buildDailyStatsFixtures } from "./stats";

interface WorkerSeed {
  instance: string;
  role: string;
  startedAt: string;
  heartbeatAge: number;
  tasks: number[];
  proxy: boolean | null;
}

export const SLOW_WORKER_ID = "analysis-2";

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
    instance: SLOW_WORKER_ID,
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

/** A worker row as the API would serve it right now: `last_seen` = now − heartbeat age. */
export function liveWorkerRow(worker: Worker, now = new Date()): Worker {
  const age = worker.heartbeat_age_seconds;
  return {
    ...worker,
    last_seen: new Date(now.getTime() - age * 1000).toISOString(),
    live: age < 180,
    running_tasks: worker.current_tasks.length,
  };
}
