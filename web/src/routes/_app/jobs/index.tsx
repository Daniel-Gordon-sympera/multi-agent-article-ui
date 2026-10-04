import { createFileRoute } from "@tanstack/react-router";
import { RunsPage } from "@/features/jobs/runs/RunsPage";
import { jobsSearchSchema } from "@/features/jobs/searchSchemas";

function RunsRoute() {
  const search = Route.useSearch();
  return <RunsPage search={search} />;
}

export const Route = createFileRoute("/_app/jobs/")({
  validateSearch: jobsSearchSchema,
  component: RunsRoute,
});
