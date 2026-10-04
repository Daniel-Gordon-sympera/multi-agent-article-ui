import { createFileRoute } from "@tanstack/react-router";
import { PreferencesPage } from "@/features/settings/preferences/PreferencesPage";

export const Route = createFileRoute("/_app/settings/preferences")({
  component: PreferencesPage,
});
