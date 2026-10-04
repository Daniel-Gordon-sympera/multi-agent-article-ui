import { createFileRoute } from "@tanstack/react-router";
import { LaterPhaseNotice } from "@/features/placeholder/LaterPhaseNotice";

function JobSiteRunsTab() {
  return (
    <section aria-labelledby="job-tab-site-runs-title" className="flex flex-col gap-4">
      <h2 id="job-tab-site-runs-title" className="text-card-title text-ink">
        Site runs
      </h2>
      <LaterPhaseNotice screen="Site runs with the finder's sources and ranking" />
    </section>
  );
}

export const Route = createFileRoute("/_app/jobs/$jobId/site-runs")({
  component: JobSiteRunsTab,
});
