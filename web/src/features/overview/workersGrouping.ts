/** Grouping of `/v1/workers` rows for the Overview "Workers" card (pure, testable). */
import type { Worker } from "@/api/types/workers";
import { formatRelativeTime, pluralize } from "@/lib/format";
import { workerStatus, type StatusTone } from "@/lib/status";

export const WORKER_ROLE_ORDER = [
  "api",
  "maintenance",
  "finder",
  "sections",
  "discovery",
  "analysis",
] as const;

export interface WorkerRoleRow {
  role: string;
  count: number;
  /** Worst heartbeat tone across the role's live instances. */
  tone: StatusTone;
  labels: string[];
}

const TONE_RANK: Record<StatusTone, number> = { done: 0, running: 0, neutral: 0, warn: 1, fail: 2 };

export function groupWorkersByRole(workers: Worker[], now: Date): WorkerRoleRow[] {
  const rows = new Map<string, WorkerRoleRow>();
  for (const worker of workers) {
    if (worker.gone_at) continue;
    const status = workerStatus(worker, now);
    const row = rows.get(worker.role) ?? { role: worker.role, count: 0, tone: "done", labels: [] };
    row.count += 1;
    row.labels.push(`${worker.instance_id}: ${status.label}`);
    if (TONE_RANK[status.tone] > TONE_RANK[row.tone]) row.tone = status.tone;
    rows.set(worker.role, row);
  }
  const order = (role: string) => {
    const index = (WORKER_ROLE_ORDER as readonly string[]).indexOf(role);
    return index === -1 ? WORKER_ROLE_ORDER.length : index;
  };
  return [...rows.values()].sort(
    (a, b) => order(a.role) - order(b.role) || a.role.localeCompare(b.role),
  );
}

/** "proxy exit US verified 4 min ago" from the newest proxy check of a crawl worker. */
export function proxySummary(workers: Worker[], now: Date): string {
  const checked = workers.filter((w) => !w.gone_at && w.proxy_checked_at);
  if (checked.length === 0) return "proxy not checked yet";
  const failing = checked.filter((w) => !w.proxy_ok).length;
  if (failing > 0) return `proxy check failing on ${pluralize(failing, "worker")}`;
  const latest = checked
    .map((w) => w.proxy_checked_at as string)
    .sort()
    .at(-1);
  return `proxy exit US verified ${formatRelativeTime(latest, { now })}`;
}
