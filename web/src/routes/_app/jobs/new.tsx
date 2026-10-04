import { createFileRoute } from "@tanstack/react-router";
import { NewRunPage } from "@/features/jobs/newRun/NewRunPage";
import { newRunSearchSchema } from "@/features/jobs/searchSchemas";

function NewRunRoute() {
  const search = Route.useSearch();
  return <NewRunPage search={search} />;
}

export const Route = createFileRoute("/_app/jobs/new")({
  validateSearch: newRunSearchSchema,
  component: NewRunRoute,
});
