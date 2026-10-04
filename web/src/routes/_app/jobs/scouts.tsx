import { createFileRoute } from "@tanstack/react-router";
import { JobsPageHeader } from "@/features/jobs/JobsPageHeader";
import { scoutsSearchSchema } from "@/features/jobs/searchSchemas";
import { LaterPhaseNotice } from "@/features/placeholder/LaterPhaseNotice";

function ScoutsPage() {
  return (
    <>
      <JobsPageHeader />
      <LaterPhaseNotice screen="The Scouts table (saved setups, last run, Run / Edit actions)" />
    </>
  );
}

export const Route = createFileRoute("/_app/jobs/scouts")({
  validateSearch: scoutsSearchSchema,
  component: ScoutsPage,
});
