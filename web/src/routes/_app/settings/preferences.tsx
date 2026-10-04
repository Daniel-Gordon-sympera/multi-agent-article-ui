import { createFileRoute } from "@tanstack/react-router";
import { LaterPhaseNotice } from "@/features/placeholder/LaterPhaseNotice";

function SettingsPreferencesPage() {
  return (
    <section aria-labelledby="settings-preferences-title" className="flex flex-col gap-4">
      <h2 id="settings-preferences-title" className="text-card-title text-ink">
        Preferences
      </h2>
      <LaterPhaseNotice screen="Theme, density, time display and landing page" />
    </section>
  );
}

export const Route = createFileRoute("/_app/settings/preferences")({
  component: SettingsPreferencesPage,
});
