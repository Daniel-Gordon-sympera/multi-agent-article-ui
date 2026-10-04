import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/PageHeader";
import { newRunSearchSchema } from "@/features/jobs/searchSchemas";
import { LaterPhaseNotice } from "@/features/placeholder/LaterPhaseNotice";

function NewRunPage() {
  return (
    <>
      <PageHeader
        crumbs={[
          <Link key="jobs" to="/jobs">
            Jobs
          </Link>,
          "New run",
        ]}
        title="New run"
        subtitle="Launch one job per industry, or save the setup as a Scout to run again later"
      />
      <LaterPhaseNotice screen="The New run / Scout form with its fan-out preview and summary" />
    </>
  );
}

export const Route = createFileRoute("/_app/jobs/new")({
  validateSearch: newRunSearchSchema,
  component: NewRunPage,
});
