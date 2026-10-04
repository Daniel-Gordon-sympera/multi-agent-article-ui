import { createFileRoute } from "@tanstack/react-router";
import { LaterPhaseNotice } from "@/features/placeholder/LaterPhaseNotice";

function SettingsWorkersPage() {
  return (
    <section aria-labelledby="settings-workers-title" className="flex flex-col gap-4">
      <h2 id="settings-workers-title" className="text-card-title text-ink">
        Workers & health
      </h2>
      <LaterPhaseNotice screen="Health tiles, the workers table, dead tasks by category and the maintenance schedule" />
    </section>
  );
}

export const Route = createFileRoute("/_app/settings/workers")({
  component: SettingsWorkersPage,
});
