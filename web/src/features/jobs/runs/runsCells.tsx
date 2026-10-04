/** Cells of the Runs table; the polled facts come from `RunsColumnContext` (see runsFacts). */
import { Link } from "@tanstack/react-router";
import type { JobRecord } from "@/api/types/jobs";
import { RelativeTime } from "@/components/RelativeTime";
import { StageBar } from "@/components/StageBar";
import { StatusPill } from "@/components/StatusPill";
import { Tag } from "@/components/Tag";
import { jobKindLabel, jobTitle } from "@/features/jobs/jobTitle";
import { stageHintOf } from "@/features/jobs/shared/jobFacts";
import { formatDuration, formatMoney, shortId } from "@/lib/format";
import {
  RunsColumnContext,
  costOf,
  countCell,
  counterOf,
  durationOf,
  sitesOf,
  type Counter,
} from "./runsFacts";

export function JobCell({ job }: { job: JobRecord }) {
  const batch = RunsColumnContext.useColumnContext().batches[job.id];
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <Link
        to="/jobs/$jobId"
        params={{ jobId: job.id }}
        className="truncate font-semibold text-ink hover:text-brand-700"
      >
        {jobTitle(job)}
      </Link>
      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[12px] text-muted">
        <span className="font-mono">{shortId(job.id)}</span>
        <span aria-hidden>·</span>
        <span>{jobKindLabel(job.kind)}</span>
        {batch ? (
          <Tag tone="brand">
            batch {batch.position} of {batch.size}
          </Tag>
        ) : null}
      </div>
    </div>
  );
}

export function StatusCell({ job }: { job: JobRecord }) {
  const showReason = job.status === "partial" || job.status === "failed";
  return (
    <StatusPill
      entity="job"
      status={job.status}
      secondary={showReason ? (job.stop_reason ?? undefined) : undefined}
    />
  );
}

export function StagesCell({ job }: { job: JobRecord }) {
  const snapshot = RunsColumnContext.useColumnContext().progress[job.id];
  return (
    <StageBar
      status={job.status}
      stopReason={job.stop_reason}
      progress={stageHintOf(snapshot?.progress ?? job.summary)}
    />
  );
}

export function SitesCell({ job }: { job: JobRecord }) {
  return <>{sitesOf(job, RunsColumnContext.useColumnContext().progress[job.id])}</>;
}

export function CounterCell({ job, counter }: { job: JobRecord; counter: Counter }) {
  return (
    <>{countCell(counterOf(job, RunsColumnContext.useColumnContext().progress[job.id], counter))}</>
  );
}

export function CostCell({ job }: { job: JobRecord }) {
  const cost = costOf(job, RunsColumnContext.useColumnContext().progress[job.id]);
  return <>{cost === null || cost === 0 ? "—" : formatMoney(cost)}</>;
}

export function StartedCell({ job }: { job: JobRecord }) {
  const duration = durationOf(job, RunsColumnContext.useColumnContext().progress[job.id]);
  return (
    <div className="flex flex-col gap-0.5">
      <RelativeTime value={job.started_at ?? job.created_at} mode="smart" fallback="—" />
      <span className="text-[12px] text-muted">
        {job.started_at && duration !== null ? formatDuration(duration) : "—"}
      </span>
    </div>
  );
}
