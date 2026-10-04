import { createFileRoute } from "@tanstack/react-router";
import { LaterPhaseNotice } from "@/features/placeholder/LaterPhaseNotice";

function SettingsSystemPage() {
  return (
    <section aria-labelledby="settings-system-title" className="flex flex-col gap-4">
      <h2 id="settings-system-title" className="text-card-title text-ink">
        System
      </h2>
      <LaterPhaseNotice screen="BFF and pipeline versions, readiness checks, prompt version and capabilities" />
    </section>
  );
}

export const Route = createFileRoute("/_app/settings/system")({
  component: SettingsSystemPage,
});
