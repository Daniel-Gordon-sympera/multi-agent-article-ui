/**
 * "Pipeline progress" card — mockup §3.5: sub "Live · refreshed N s ago" with the blue
 * "Auto-refresh every 5 s" dot while the job runs, the 5-step Stepper and the counter strip
 * (Seeds … Signals | Cost so far · Elapsed + deadline · Tasks queued/running/dead).
 */
import type { JobDetail, JobProgress, LiveJobSummary, StoredJobSummary } from "@/api/types/jobs";
import type { SiteRun } from "@/api/types/siteRuns";
import type { Task } from "@/api/types/tasks";
import { Card, CardHeader } from "@/components/Card";
import { CounterStrip } from "@/components/CounterStrip";
import { LiveDot } from "@/components/LiveDot";
import { RelativeTime } from "@/components/RelativeTime";
import { Stepper } from "@/components/Stepper";
import { totalCostUsd, totalTokens } from "@/features/jobs/shared/jobFacts";
import {
  formatCompactNumber,
  formatCountdown,
  formatDuration,
  formatInteger,
  formatMoney,
  formatRelativeTime,
  secondsBetween,
} from "@/lib/format";
import { useNow } from "@/lib/hooks/useNow";
import { isTerminalJobStatus } from "@/lib/status";
import { buildStepperSteps } from "./stepperModel";

export interface PipelineProgressCardProps {
  job: JobDetail;
  progress: JobProgress;
  live: LiveJobSummary | null;
  stored: StoredJobSummary | null;
  siteRuns: readonly SiteRun[];
  tasks: readonly Task[];
  /** When the job detail query last succeeded. */
  refreshedAt: number | null;
}

export function PipelineProgressCard({
  job,
  progress,
  live,
  stored,
  siteRuns,
  tasks,
  refreshedAt,
}: PipelineProgressCardProps) {
  const now = useNow(1000);
  const terminal = isTerminalJobStatus(job.status);
  const costs = live?.costs ?? job.costs;
  const cost = totalCostUsd(costs);
  const tokens = totalTokens(costs);
  const elapsed =
    live?.duration_seconds ??
    stored?.duration_seconds ??
    (job.started_at ? secondsBetween(job.started_at, job.finished_at, now) : null);
  const steps = buildStepperSteps({ job, progress, siteRuns, tasks, summary: stored, now });

  const subtitle = terminal ? (
    <>
      Final · finished <RelativeTime value={job.finished_at} mode="smart" className="lowercase" />
    </>
  ) : (
    <>Live · refreshed {refreshedAt ? formatRelativeTime(new Date(refreshedAt), { now }) : "—"}</>
  );

  return (
    <Card aria-labelledby="pipeline-progress-title">
      <CardHeader
        id="pipeline-progress-title"
        title="Pipeline progress"
        subtitle={subtitle}
        aside={
          terminal ? (
            <LiveDot tone="neutral" label="Final" pulse={false} />
          ) : (
            <LiveDot label="Auto-refresh every 5 s" />
          )
        }
      />
      <Stepper steps={steps} />
      <CounterStrip
        className="border-t border-border pt-4"
        counters={[
          { key: "seeds", label: "Seeds", value: formatInteger(progress.seeds) },
          { key: "sections", label: "Sections", value: formatInteger(progress.sections) },
          { key: "pages", label: "Pages", value: formatInteger(progress.pages) },
          { key: "links", label: "Links", value: formatCompactNumber(progress.links) },
          { key: "articles", label: "Articles", value: formatInteger(progress.articles) },
          {
            key: "summaries",
            label: "Summaries",
            value: `${formatInteger(progress.summaries)} / ${formatInteger(progress.articles)}`,
          },
          { key: "companies", label: "Companies", value: formatInteger(progress.companies) },
          { key: "signals", label: "Signals", value: formatInteger(progress.signals) },
        ]}
        secondary={[
          {
            key: "cost",
            label: terminal ? "Cost" : "Cost so far",
            value: `${formatMoney(cost)} · ${tokens === null ? "—" : `${formatCompactNumber(tokens)} tokens`}`,
          },
          {
            key: "elapsed",
            label: "Elapsed",
            value: terminal
              ? formatDuration(elapsed)
              : `${formatDuration(elapsed)} · ${job.deadline_at ? `deadline ${formatCountdown(job.deadline_at, { now })}` : "no deadline"}`,
          },
          {
            key: "tasks",
            label: "Tasks",
            value: `${formatInteger(progress.tasks_pending)} queued · ${formatInteger(progress.tasks_running)} running · ${formatInteger(progress.tasks_dead)} dead`,
          },
        ]}
      />
    </Card>
  );
}
