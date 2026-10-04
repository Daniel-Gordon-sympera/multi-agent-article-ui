import { createFileRoute } from "@tanstack/react-router";
import { ExportsPage } from "@/features/settings/exports/ExportsPage";

export const Route = createFileRoute("/_app/settings/exports")({
  component: ExportsPage,
});
