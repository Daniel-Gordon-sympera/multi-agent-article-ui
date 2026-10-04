import { createFileRoute } from "@tanstack/react-router";
import { LaterPhaseNotice } from "@/features/placeholder/LaterPhaseNotice";

function SettingsExportsPage() {
  return (
    <section aria-labelledby="settings-exports-title" className="flex flex-col gap-4">
      <h2 id="settings-exports-title" className="text-card-title text-ink">
        Exports
      </h2>
      <LaterPhaseNotice screen="The exports center for dataset and per-job CSV exports" />
    </section>
  );
}

export const Route = createFileRoute("/_app/settings/exports")({
  component: SettingsExportsPage,
});
