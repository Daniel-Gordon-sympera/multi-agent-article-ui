/**
 * Pure wording for Settings › Workers & health (mockup §3.11): current tasks, proxy cells and
 * the health tiles' rows. Everything the API does not expose is marked honestly.
 */
import type { QueueSummary, SystemInfo } from "@/api/types/bff";
import type { Worker } from "@/api/types/workers";
import { formatRelativeTime, pluralize } from "@/lib/format";
import { workerHeartbeatAge, workerStatus } from "@/lib/status";
import type { StatusDescriptor } from "@/lib/status";

export const NOT_EXPOSED = "not exposed by the API";
export const CRAWL_ROLES = new Set(["finder", "sections", "discovery"]);

/** `current_tasks` holds task ids only: "—" (none), "1 task", "2 tasks". */
export function currentTasksLabel(worker: Pick<Worker, "current_tasks">): string {
  const count = worker.current_tasks?.length ?? 0;
  return count === 0 ? "—" : pluralize(count, "task");
}

/** "US · ok" · "US · failing" · "—" when the worker has no proxy check. */
export function proxyLabel(worker: Pick<Worker, "proxy_ok">): string {
  if (worker.proxy_ok === null || worker.proxy_ok === undefined) return "—";
  return worker.proxy_ok ? "US · ok" : "US · failing";
}

export interface HealthRow {
  label: string;
  value: string;
  tone?: "muted" | "warn";
}

export interface HealthTileModel {
  title: string;
  status: StatusDescriptor;
  rows: HealthRow[];
}

function checkWord(value: string | boolean | undefined): string {
  if (value === undefined) return "unknown";
  if (value === true) return "ok";
  if (value === false) return "failing";
  return String(value);
}

export function apiTile(system: SystemInfo | undefined): HealthTileModel {
  const checks = system?.pipeline.checks ?? {};
  const status: StatusDescriptor = system
    ? system.pipeline.ready
      ? { tone: "done", label: "Ready", indicator: "dot" }
      : { tone: "fail", label: "Not ready", indicator: "dot" }
    : { tone: "neutral", label: "Loading", indicator: "none" };
  return {
    title: "API",
    status,
    rows: [
      { label: "Database", value: checkWord(checks.database) },
      { label: "Artifact store", value: checkWord(checks.artifact_store) },
      { label: "Migrations", value: checkWord(checks.migrations) },
      { label: "Version", value: system?.pipeline.version ?? "—" },
    ],
  };
}

export function proxyTile(workers: Worker[] | undefined, now: Date): HealthTileModel {
  const crawl = (workers ?? []).filter((w) => !w.gone_at && CRAWL_ROLES.has(w.role));
  const checked = crawl.filter((w) => w.proxy_ok !== null);
  const failing = checked.filter((w) => w.proxy_ok === false).length;
  const latest = checked
    .map((w) => w.proxy_checked_at)
    .filter((v): v is string => !!v)
    .sort()
    .at(-1);
  const status: StatusDescriptor = !workers
    ? { tone: "neutral", label: "Loading", indicator: "none" }
    : checked.length === 0
      ? { tone: "neutral", label: "Not checked", indicator: "dot" }
      : failing === 0
        ? { tone: "done", label: "US exit verified", indicator: "dot" }
        : { tone: "fail", label: `${failing} failing`, indicator: "dot" };
  return {
    title: "Proxy",
    status,
    rows: [
      { label: "Checked", value: latest ? formatRelativeTime(latest, { now }) : "—" },
      {
        label: "Crawl workers",
        value: checked.length ? `${checked.length - failing} of ${checked.length} ok` : "—",
      },
      { label: "Zone", value: NOT_EXPOSED, tone: "muted" },
      { label: "Traffic today", value: NOT_EXPOSED, tone: "muted" },
    ],
  };
}

export function queueTile(queue: QueueSummary | undefined): HealthTileModel {
  const status: StatusDescriptor = !queue
    ? { tone: "neutral", label: "Loading", indicator: "none" }
    : queue.dead > 0
      ? { tone: "warn", label: `${queue.dead} dead`, indicator: "dot" }
      : { tone: "done", label: "No dead tasks", indicator: "dot" };
  return {
    title: "Queue",
    status,
    rows: [
      { label: "Queued", value: queue ? String(queue.queued) : "—" },
      { label: "Running", value: queue ? String(queue.running) : "—" },
      {
        label: "Failed · retrying",
        value: queue ? (queue.failed === null ? "unknown without B3" : String(queue.failed)) : "—",
        tone: queue?.failed === null ? "muted" : undefined,
      },
      { label: "Dead", value: queue ? String(queue.dead) : "—" },
    ],
  };
}

export function storageTile(): HealthTileModel {
  return {
    title: "Storage",
    status: { tone: "neutral", label: "Not exposed", indicator: "dot" },
    rows: [
      { label: "Snapshots", value: NOT_EXPOSED, tone: "muted" },
      { label: "Expiring in 7 d", value: NOT_EXPOSED, tone: "muted" },
      { label: "Last backup", value: NOT_EXPOSED, tone: "muted" },
      { label: "Disk", value: NOT_EXPOSED, tone: "muted" },
    ],
  };
}

export function workersSubtitle(workers: Worker[] | undefined): string {
  if (!workers) return "loading…";
  const live = workers.filter((w) => !w.gone_at);
  return `${pluralize(live.length, "instance")} · heartbeats every 30 s · gone after 3 missed`;
}

/** Row wording of the heartbeat cell plus whether it gets the amber "slow" style. */
export function heartbeatCell(worker: Worker, now: Date): { text: string; slow: boolean } {
  const age = workerHeartbeatAge(worker, now);
  const status = workerStatus(worker, now);
  return {
    text: Number.isFinite(age) ? formatRelativeTime(worker.last_seen, { now }) : "never",
    slow: status.tone !== "done",
  };
}
