import { createFileRoute } from "@tanstack/react-router";
import { useTabHandlers } from "@/features/jobs/shared/useTabHandlers";
import { SiteRunsTab } from "@/features/jobs/siteRuns/SiteRunsTab";
import { siteRunsTabSearchSchema, type SiteRunsTabSearch } from "@/features/jobs/tabSearchSchemas";

function JobSiteRunsTab() {
  const { jobId } = Route.useParams();
  const search = Route.useSearch();
  const handlers = useTabHandlers<SiteRunsTabSearch>(Route.useNavigate());
  return <SiteRunsTab jobId={jobId} search={search} {...handlers} />;
}

export const Route = createFileRoute("/_app/jobs/$jobId/site-runs")({
  validateSearch: siteRunsTabSearchSchema,
  component: JobSiteRunsTab,
});
