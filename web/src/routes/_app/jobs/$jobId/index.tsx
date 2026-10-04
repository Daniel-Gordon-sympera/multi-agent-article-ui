import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { JobOverviewTab } from "@/features/jobs/overview/JobOverviewTab";
import { optionalString } from "@/lib/url";

function JobIndexTab() {
  const { jobId } = Route.useParams();
  return <JobOverviewTab jobId={jobId} />;
}

export const Route = createFileRoute("/_app/jobs/$jobId/")({
  /** `?work=<siteRunId>` opens the Work items drawer of the Site runs section. */
  validateSearch: z.object({ work: optionalString }),
  component: JobIndexTab,
});
