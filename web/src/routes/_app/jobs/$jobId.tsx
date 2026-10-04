import { createFileRoute, Link, Outlet, useLocation } from "@tanstack/react-router";
import { ErrorState } from "@/components/ErrorState";
import { JobSummaryStrip } from "@/components/JobSummaryStrip";
import { Breadcrumbs } from "@/components/PageHeader";
import { Skeleton } from "@/components/Skeleton";
import { JobHeader } from "@/features/jobs/JobHeader";
import { JobTabs } from "@/features/jobs/JobTabs";
import { useBatchMembership, useJobDetail, useJobSummary } from "@/features/jobs/useJobQueries";
import { shortId } from "@/lib/format";
import { secondsBetween } from "@/lib/format";

function jobCost(
  costs: Array<{ cost_usd: number | null; known_cost_usd: number }> | undefined,
): number | null {
  if (!costs || costs.length === 0) return null;
  return costs.reduce((sum, c) => sum + (c.cost_usd ?? c.known_cost_usd ?? 0), 0);
}

function JobDetailLayout() {
  const { jobId } = Route.useParams();
  const location = useLocation();
  const job = useJobDetail(jobId);
  const summary = useJobSummary(jobId, job.data?.status, { enabled: job.isSuccess });
  const batches = useBatchMembership(job.data ? [job.data.id] : []);
  const isOverview = location.pathname.replace(/\/$/, "") === `/jobs/${jobId}`;

  if (job.isPending) {
    return (
      <div className="flex flex-col gap-5" aria-busy="true">
        <Breadcrumbs
          crumbs={[
            <Link key="jobs" to="/jobs">
              Jobs
            </Link>,
            <span key="id" className="font-mono">
              {shortId(jobId)}
            </span>,
          ]}
        />
        <Skeleton className="h-8 w-96" />
        <Skeleton className="h-4 w-[520px]" />
        <Skeleton className="h-10 w-full" />
        <span className="sr-only">Loading job…</span>
      </div>
    );
  }
  if (job.isError) {
    return (
      <div className="flex flex-col gap-5">
        <Breadcrumbs
          crumbs={[
            <Link key="jobs" to="/jobs">
              Jobs
            </Link>,
            <span key="id" className="font-mono">
              {shortId(jobId)}
            </span>,
          ]}
        />
        <ErrorState
          error={job.error}
          title="This job could not be loaded"
          onRetry={() => void job.refetch()}
          retrying={job.isFetching}
        />
      </div>
    );
  }

  const data = job.data;
  const live = summary.data?.kind === "live" ? summary.data.summary : null;
  const progress = live?.progress ?? data.progress;
  const costs = live?.costs ?? data.costs;
  const elapsed = live?.duration_seconds ?? secondsBetween(data.started_at, data.finished_at);

  return (
    <>
      <JobHeader job={data} batch={batches.data?.batches[data.id] ?? null} />
      {!isOverview ? (
        <JobSummaryStrip
          status={data.status}
          stopReason={data.stop_reason}
          progress={progress}
          costUsd={jobCost(costs)}
          elapsedSeconds={elapsed}
        />
      ) : null}
      <JobTabs jobId={data.id} progress={progress} />
      <Outlet />
    </>
  );
}

export const Route = createFileRoute("/_app/jobs/$jobId")({
  component: JobDetailLayout,
});
