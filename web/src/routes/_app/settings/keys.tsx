import { createFileRoute } from "@tanstack/react-router";
import { LaterPhaseNotice } from "@/features/placeholder/LaterPhaseNotice";

function SettingsKeysPage() {
  return (
    <section aria-labelledby="settings-keys-title" className="flex flex-col gap-4">
      <h2 id="settings-keys-title" className="text-card-title text-ink">
        API keys
      </h2>
      <LaterPhaseNotice screen="API keys of the pipeline (create and revoke; the list needs capability api_keys_list)" />
    </section>
  );
}

export const Route = createFileRoute("/_app/settings/keys")({
  component: SettingsKeysPage,
});
