import { createFileRoute } from "@tanstack/react-router";
import { LaterPhaseNotice } from "@/features/placeholder/LaterPhaseNotice";

function JobSignalsTab() {
  return (
    <section aria-labelledby="job-tab-signals-title" className="flex flex-col gap-4">
      <h2 id="job-tab-signals-title" className="text-card-title text-ink">
        Signals
      </h2>
      <LaterPhaseNotice screen="The signals of this job with their evidence" />
    </section>
  );
}

export const Route = createFileRoute("/_app/jobs/$jobId/signals")({
  component: JobSignalsTab,
});
