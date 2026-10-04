import { createFileRoute } from "@tanstack/react-router";
import { SystemPage } from "@/features/settings/system/SystemPage";

export const Route = createFileRoute("/_app/settings/system")({
  component: SystemPage,
});
