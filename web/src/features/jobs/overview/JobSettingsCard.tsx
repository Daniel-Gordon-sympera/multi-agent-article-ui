/**
 * "Settings" card — mockup §3.5: KeyValueGrid of the settings saved with the job (Days, Sites,
 * Site timeout, Max runtime, Memory, Reanalyze, Client ref, Location) plus any extra keys.
 */
import type { JobRecord } from "@/api/types/jobs";
import { Card, CardHeader } from "@/components/Card";
import { KeyValueGrid } from "@/components/KeyValueGrid";
import { settingsItems } from "./settingsModel";

export function JobSettingsCard({ job }: { job: JobRecord }) {
  return (
    <Card aria-labelledby="job-settings-title">
      <CardHeader
        id="job-settings-title"
        title="Settings"
        subtitle="Saved at creation; resume overrides are audited per site run"
      />
      <KeyValueGrid items={settingsItems(job)} />
    </Card>
  );
}
