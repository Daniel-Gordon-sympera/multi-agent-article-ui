import { createFileRoute } from "@tanstack/react-router";
import { LaterPhaseNotice } from "@/features/placeholder/LaterPhaseNotice";

function JobIndexTab() {
  return (
    <section aria-labelledby="job-tab-index-title" className="flex flex-col gap-4">
      <h2 id="job-tab-index-title" className="text-card-title text-ink">
        Overview
      </h2>
      <LaterPhaseNotice screen="The job overview (pipeline progress, counters, site runs, cost by stage, settings)" />
    </section>
  );
}

export const Route = createFileRoute("/_app/jobs/$jobId/")({
  component: JobIndexTab,
});
