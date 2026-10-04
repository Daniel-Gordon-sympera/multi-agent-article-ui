import { createFileRoute } from "@tanstack/react-router";
import { LaterPhaseNotice } from "@/features/placeholder/LaterPhaseNotice";

function SettingsStatsPage() {
  return (
    <section aria-labelledby="settings-stats-title" className="flex flex-col gap-4">
      <h2 id="settings-stats-title" className="text-card-title text-ink">
        Stats & costs
      </h2>
      <LaterPhaseNotice screen="Daily throughput and model cost charts" />
    </section>
  );
}

export const Route = createFileRoute("/_app/settings/stats")({
  component: SettingsStatsPage,
});
