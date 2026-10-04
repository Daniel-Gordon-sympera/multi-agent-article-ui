import { createFileRoute } from "@tanstack/react-router";
import { LaterPhaseNotice } from "@/features/placeholder/LaterPhaseNotice";

function JobSummariesTab() {
  return (
    <section aria-labelledby="job-tab-summaries-title" className="flex flex-col gap-4">
      <h2 id="job-tab-summaries-title" className="text-card-title text-ink">
        Summaries
      </h2>
      <LaterPhaseNotice screen="Article summaries" />
    </section>
  );
}

export const Route = createFileRoute("/_app/jobs/$jobId/summaries")({
  component: JobSummariesTab,
});
