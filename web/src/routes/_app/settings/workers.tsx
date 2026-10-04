import { createFileRoute } from "@tanstack/react-router";
import { WorkersHealthPage } from "@/features/settings/workers/WorkersHealthPage";

export const Route = createFileRoute("/_app/settings/workers")({
  component: WorkersHealthPage,
});
