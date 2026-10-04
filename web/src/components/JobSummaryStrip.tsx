/**
 * JobSummaryStrip — mockup §3.6: compact white strip (radius 10, padding 10×16, 13 px ink-2)
 * with StageBar 140 · "Analysing · 31 / 40 summaries" · | · "139 companies · 24 signals" · |
 * · "$3.12 · 29 min" · right-aligned LiveDot. Shown on every job tab except Overview.
 */
import type { JobProgress, JobStatus } from "@/api/types/jobs";
import { LiveDot } from "@/components/LiveDot";
import { StageBar } from "@/components/StageBar";
import { cn } from "@/lib/cn";
import { formatCompactNumber, formatDuration, formatMoney } from "@/lib/format";
import { isTerminalJobStatus, jobStatus } from "@/lib/status";

export interface JobSummaryStripProps {
  status: JobStatus | string;
  stopReason?: string | null;
  progress?: Partial<JobProgress> | null;
  costUsd?: number | null;
  elapsedSeconds?: number | null;
  live?: boolean;
  className?: string;
}

export function stageDetail(
  status: string,
  progress: Partial<JobProgress> | null | undefined,
  stopReason?: string | null,
): string {
  const p = progress ?? {};
  switch (status) {
    case "finding":
      return `${p.seeds ?? 0} sources so far`;
    case "exploring":
      return `${p.seeds ?? 0} sites · ${p.sections ?? 0} sections kept`;
    case "discovering":
      return `${formatCompactNumber(p.pages ?? 0)} pages · ${p.articles ?? 0} articles`;
    case "analysing":
      return `${p.summaries ?? 0} / ${p.articles ?? 0} summaries`;
    case "finalizing":
      return "summary, costs and coverage";
    case "queued":
      return "waiting for a worker";
    default:
      return stopReason ? stopReason : `${p.summaries ?? 0} / ${p.articles ?? 0} summaries`;
  }
}

function Divider() {
  return <span className="h-5 w-px shrink-0 bg-border-strong" aria-hidden />;
}

export function JobSummaryStrip({
  status,
  stopReason,
  progress,
  costUsd,
  elapsedSeconds,
  live,
  className,
}: JobSummaryStripProps) {
  const descriptor = jobStatus(status);
  const isLive = live ?? !isTerminalJobStatus(status);
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-4 rounded-banner border border-border bg-surface px-4 py-2.5 text-[13px] text-ink-2",
        className,
      )}
      aria-label="Job summary"
    >
      <StageBar status={status} stopReason={stopReason} progress={progress} width={140} />
      <span>
        <strong className="font-semibold text-ink">{descriptor.label}</strong>
        {" · "}
        <span className={cn(stopReason && isTerminalJobStatus(status) && "font-mono text-[12px]")}>
          {stageDetail(status, progress, stopReason)}
        </span>
      </span>
      <Divider />
      <span className="tabular">
        {progress?.companies ?? 0} companies · {progress?.signals ?? 0} signals
      </span>
      <Divider />
      <span className="tabular">
        {formatMoney(costUsd)} · {formatDuration(elapsedSeconds)}
      </span>
      <span className="ml-auto">
        {isLive ? <LiveDot label="Live" /> : <LiveDot tone="neutral" label="Final" pulse={false} />}
      </span>
    </div>
  );
}
