/**
 * Task tree model (mockup §3.7 / §4.3): rows flattened in depth-first order from
 * `parent_task_id` (children sorted by id; orphans and roots at depth 0), the flat order,
 * the status count chips and the "Target" wording derived from a task's payload.
 */
import type { Task, TaskStatus } from "@/api/types/tasks";
import { createColumnContext } from "@/features/jobs/shared/columnContext";
import { secondsBetween } from "@/lib/format";

export interface TaskNode {
  task: Task;
  depth: number;
  hasChildren: boolean;
}

export function buildTaskTree(tasks: readonly Task[]): TaskNode[] {
  const ids = new Set(tasks.map((task) => task.id));
  const children = new Map<number | null, Task[]>();
  for (const task of tasks) {
    const parent =
      task.parent_task_id !== null && ids.has(task.parent_task_id) ? task.parent_task_id : null;
    const list = children.get(parent) ?? [];
    list.push(task);
    children.set(parent, list);
  }
  for (const list of children.values()) list.sort((a, b) => a.id - b.id);
  const rows: TaskNode[] = [];
  const visit = (parent: number | null, depth: number, seen: Set<number>) => {
    for (const task of children.get(parent) ?? []) {
      if (seen.has(task.id)) continue;
      seen.add(task.id);
      const kids = children.get(task.id) ?? [];
      rows.push({ task, depth, hasChildren: kids.length > 0 });
      visit(task.id, depth + 1, seen);
    }
  };
  visit(null, 0, new Set());
  return rows;
}

export function flatTaskRows(tasks: readonly Task[]): TaskNode[] {
  return [...tasks]
    .sort((a, b) => a.id - b.id)
    .map((task) => ({ task, depth: 0, hasChildren: false }));
}

export const TASK_STATUS_ORDER: readonly TaskStatus[] = [
  "queued",
  "running",
  "succeeded",
  "failed",
  "dead",
  "cancelled",
];

export function taskStatusCounts(tasks: readonly Task[]): Record<TaskStatus, number> {
  const counts: Record<TaskStatus, number> = {
    queued: 0,
    running: 0,
    succeeded: 0,
    failed: 0,
    dead: 0,
    cancelled: 0,
  };
  for (const task of tasks) {
    if (task.status in counts) counts[task.status] += 1;
  }
  return counts;
}

export const TASK_KINDS = [
  "find_sources",
  "rank_sites",
  "explore_site",
  "discover_site",
  "analyze_article",
  "finalize_job",
] as const;

const str = (value: unknown): string | null =>
  typeof value === "string" && value.trim() ? value : null;

/** "#71334 · Kirkman Road…" · "orlandomagazine.com" · "Orlando, FL · Construction" · "—". */
export function taskTarget(task: Task): string {
  const p = task.payload ?? {};
  const explicit = str(p.target);
  if (explicit) return explicit;
  const title = str(p.title) ?? str(p.article_title);
  const articleId = typeof p.article_id === "number" ? `#${p.article_id}` : null;
  if (articleId || title) return [articleId, title].filter(Boolean).join(" · ");
  const site = str(p.domain) ?? str(p.seed_url) ?? str(p.url);
  if (site) return site.replace(/^https?:\/\//, "");
  const location = str(p.location);
  const industry = str(p.industry);
  if (location || industry) return [location, industry].filter(Boolean).join(" · ");
  return "—";
}

/** "finder-1" from "finder-1@host" or the raw claimed_by. */
export function taskWorker(task: Task): string | null {
  if (!task.claimed_by) return null;
  return task.claimed_by.split("@")[0] ?? task.claimed_by;
}

export function taskDuration(task: Task, now: Date): number | null {
  if (!task.started_at) return null;
  if (task.status === "running") return secondsBetween(task.started_at, null, now);
  if (!task.finished_at) return null;
  return secondsBetween(task.started_at, task.finished_at, now);
}

export interface TasksColumnFacts {
  now: Date;
  canOperate: boolean;
  retryingId: number | null;
  onDetails: (task: Task) => void;
  onRetry: (task: Task) => void;
}

/** The clock, the role and the handlers reach the cells without rebuilding the columns. */
export const TasksColumnContext = createColumnContext<TasksColumnFacts>("Tasks");
