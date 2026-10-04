import { createFileRoute } from "@tanstack/react-router";
import { JobsPageHeader } from "@/features/jobs/JobsPageHeader";
import { jobsSearchSchema } from "@/features/jobs/searchSchemas";
import { LaterPhaseNotice } from "@/features/placeholder/LaterPhaseNotice";

function RunsPage() {
  return (
    <>
      <JobsPageHeader />
      <LaterPhaseNotice screen="The Runs table with its filters and row actions" />
    </>
  );
}

export const Route = createFileRoute("/_app/jobs/")({
  validateSearch: jobsSearchSchema,
  component: RunsPage,
});
