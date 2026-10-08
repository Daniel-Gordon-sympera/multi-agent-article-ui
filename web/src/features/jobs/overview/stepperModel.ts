/**
 * The "Pipeline progress" stepper (mockup §3.5): per stage its state (from the job status), a
 * duration (from the stage's tasks, else the job/site-run timestamps) and a stats line from
 * `progress`, the site runs and the stored summary. Facts the API does not provide read "—".
 */
import type { JobDetail, JobProgress, StoredJobSummary } from "@/api/types/jobs";
import type { SiteRun } from "@/api/types/siteRuns";
import type { Task } from "@/api/types/tasks";
import type { StepperStep } from "@/components/Stepper";
import { formatCompactNumber, formatDuration, parseDate } from "@/lib/format";
import { STAGES, deriveStageStates, type Stage, type StageState } from "@/lib/status";
import { stageHintOf } from "@/features/jobs/shared/jobFacts";

const STAGE_TASK_KINDS: Record<Stage, string[]> = {
  finding: ["find_sources", "rank_sites"],
  exploring: ["explore_site"],
  discovering: ["discover_site"],
  analysing: ["analyze_article"],
  finalizing: ["finalize_job"],
};

export interface StepperInput {
  job: JobDetail;
  progress: JobProgress;
  siteRuns: readonly SiteRun[];
  tasks: readonly Task[];
  summary: StoredJobSummary | null;
  now: Date;
}

interface Span {
  start: number;
  end: number | null;
}

function spanOf(items: Array<{ start?: string | null; end?: string | null }>): Span | null {
  let start = Number.POSITIVE_INFINITY;
  let end: number | null = Number.NEGATIVE_INFINITY;
  let any = false;
  for (const item of items) {
    const s = parseDate(item.start)?.getTime();
    if (s === undefined) continue;
    any = true;
    start = Math.min(start, s);
    const e = parseDate(item.end)?.getTime();
    if (e === undefined) end = null;
    else if (end !== null) end = Math.max(end, e);
  }
  return any ? { start, end } : null;
}

/** Duration of a stage from its tasks; falls back to the site runs for exploring/discovering. */
export function stageSpan(stage: Stage, input: StepperInput): Span | null {
  const kinds = STAGE_TASK_KINDS[stage];
  const tasks = input.tasks.filter((task) => kinds.includes(task.kind) && task.started_at);
  if (tasks.length) {
    return spanOf(
      tasks.map((task) => ({
        start: task.started_at,
        end: task.status === "running" ? null : (task.finished_at ?? task.started_at),
      })),
    );
  }
  if (stage === "exploring" || stage === "discovering") {
    const runs = input.siteRuns.filter((run) => run.started_at);
    if (runs.length) {
      return spanOf(runs.map((run) => ({ start: run.started_at, end: run.finished_at })));
    }
  }
  if (stage === "finding" && input.job.started_at) {
    const first = spanOf(input.siteRuns.map((run) => ({ start: run.started_at, end: null })));
    return { start: parseDate(input.job.started_at)!.getTime(), end: first?.start ?? null };
  }
  return null;
}

export function stageDuration(stage: Stage, state: StageState, input: StepperInput): string {
  if (state === "pending") return "—";
  const span = stageSpan(stage, input);
  if (!span) return state === "done" ? "done" : "—";
  const end = span.end ?? input.now.getTime();
  const text = formatDuration(Math.max(0, (end - span.start) / 1000));
  return state === "current" && span.end === null ? `${text} so far` : text;
}

function findSourcesResult(tasks: readonly Task[]): Record<string, unknown> | null {
  const task = tasks.find((t) => t.kind === "find_sources" && t.result);
  return task?.result ?? null;
}

const count = (value: unknown): string =>
  typeof value === "number" ? formatCompactNumber(value) : "—";

export function stageStats(stage: Stage, input: StepperInput): string {
  const { progress, siteRuns, summary } = input;
  switch (stage) {
    case "finding": {
      const result = findSourcesResult(input.tasks);
      const judged = result?.domains_judged ?? summary?.sources ?? null;
      const queries = typeof result?.queries === "number" ? `${result.queries} queries · ` : "";
      return `${queries}${count(judged)} domains judged · ${progress.seeds} kept`;
    }
    case "exploring": {
      const none = siteRuns.filter((run) => run.status === "no_sections").length;
      return `${progress.seeds} sites · ${progress.sections} sections kept · ${none} no_sections`;
    }
    case "discovering":
      return `${count(progress.pages)} pages · ${count(progress.links)} links · ${progress.articles} articles`;
    case "analysing":
      return `${progress.summaries} / ${progress.articles} summaries · ${progress.companies} companies · ${progress.signals} signals`;
    case "finalizing":
      return "summary, costs and coverage";
  }
}

export function buildStepperSteps(input: StepperInput): StepperStep[] {
  const states = deriveStageStates(input.job.status, {
    stopReason: input.job.stop_reason,
    progress: stageHintOf(input.progress),
  });
  return STAGES.map((stage, index) => {
    const state = states[index] ?? "pending";
    return {
      stage,
      state,
      duration: stageDuration(stage, state, input),
      stats: state === "pending" && stage !== "finalizing" ? undefined : stageStats(stage, input),
    };
  });
}
