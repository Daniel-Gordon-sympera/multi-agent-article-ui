/**
 * Job › Overview — mockup §3.5: the "Pipeline progress" card, the Site runs section with its
 * "Open tab ›" link, then the 2-up grid of "Cost by stage" and "Settings".
 */
import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { listJobSiteRuns } from "@/api/pipeline";
import { SectionHeader } from "@/components/Card";
import { ErrorState } from "@/components/ErrorState";
import { SkeletonLines } from "@/components/Skeleton";
import { SiteRunsTable } from "@/features/jobs/siteRuns/SiteRunsTable";
import { useAllJobTasks, useJobResourcePage } from "@/features/jobs/useJobResourcePage";
import { useJobDetail, useJobSummary } from "@/features/jobs/useJobQueries";
import type { SiteRun } from "@/api/types/siteRuns";
import { isTerminalJobStatus } from "@/lib/status";
import { CostByStageCard } from "./CostByStageCard";
import { JobSettingsCard } from "./JobSettingsCard";
import { PipelineProgressCard } from "./PipelineProgressCard";

export function JobOverviewTab({ jobId }: { jobId: string }) {
  const job = useJobDetail(jobId);
  const summary = useJobSummary(jobId, job.data?.status, { enabled: job.isSuccess });
  const siteRuns = useJobResourcePage<SiteRun, Record<string, never>>({
    jobId,
    resource: "site-runs",
    filters: {},
    fetchPage: (id, _filters, page) => listJobSiteRuns(id, {}, page),
    jobStatus: job.data?.status,
    kind: "operations",
    limit: 50,
  });
  const tasks = useAllJobTasks(jobId, job.data?.status);

  if (job.isPending) return <SkeletonLines lines={6} />;
  if (job.isError || !job.data) {
    return <ErrorState error={job.error} onRetry={() => void job.refetch()} />;
  }
  const data = job.data;
  const live = summary.data?.kind === "live" ? summary.data.summary : null;
  const stored = summary.data?.kind === "stored" ? summary.data.summary : data.summary;
  const progress = live?.progress ?? data.progress;
  const costs = live?.costs ?? data.costs;

  return (
    <div className="flex flex-col gap-5">
      <PipelineProgressCard
        job={data}
        progress={progress}
        live={live}
        stored={stored}
        siteRuns={siteRuns.items}
        tasks={tasks.data ?? []}
        refreshedAt={job.dataUpdatedAt || null}
      />
      <section aria-labelledby="overview-site-runs-title" className="flex flex-col gap-3">
        <SectionHeader
          title={<span id="overview-site-runs-title">Site runs</span>}
          aside={
            <Link
              to="/jobs/$jobId/site-runs"
              params={{ jobId }}
              className="inline-flex items-center gap-0.5 text-[13px] font-medium text-brand-600 hover:text-brand-700 hover:underline"
            >
              Open tab
              <ChevronRight size={13} strokeWidth={2.25} aria-hidden />
            </Link>
          }
        />
        <SiteRunsTable job={data} page={siteRuns} withPagination={siteRuns.hasNext} />
      </section>
      <div className="grid gap-5 [grid-template-columns:repeat(auto-fit,minmax(min(380px,100%),1fr))]">
        <CostByStageCard
          costs={costs}
          summary={stored}
          siteRuns={siteRuns.items}
          terminal={isTerminalJobStatus(data.status)}
        />
        <JobSettingsCard job={data} />
      </div>
    </div>
  );
}
