import { createFileRoute } from "@tanstack/react-router";
import { StatsPage } from "@/features/settings/stats/StatsPage";

export const Route = createFileRoute("/_app/settings/stats")({
  component: StatsPage,
});
