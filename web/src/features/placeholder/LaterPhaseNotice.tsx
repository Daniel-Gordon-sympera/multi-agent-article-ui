/**
 * Placeholder body for screens that feature agents implement in a later phase. Delete this file
 * once the last placeholder route has been replaced.
 */
import { Construction } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";

export function LaterPhaseNotice({ screen }: { screen: string }) {
  return (
    <EmptyState
      icon={<Construction />}
      title="This screen is built in a later phase"
      description={`${screen} will appear here once its feature phase lands. The shell, data layer and shared components are ready for it.`}
      data-testid="later-phase"
    />
  );
}
