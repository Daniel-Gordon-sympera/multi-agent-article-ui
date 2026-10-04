import { createFileRoute } from "@tanstack/react-router";
import { LaterPhaseNotice } from "@/features/placeholder/LaterPhaseNotice";

function JobEventsTab() {
  return (
    <section aria-labelledby="job-tab-events-title" className="flex flex-col gap-4">
      <h2 id="job-tab-events-title" className="text-card-title text-ink">
        Events
      </h2>
      <LaterPhaseNotice screen="The event stream of this job" />
    </section>
  );
}

export const Route = createFileRoute("/_app/jobs/$jobId/events")({
  component: JobEventsTab,
});
