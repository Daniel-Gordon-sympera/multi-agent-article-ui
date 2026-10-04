import { createFileRoute } from "@tanstack/react-router";
import { LaterPhaseNotice } from "@/features/placeholder/LaterPhaseNotice";

function JobSectionsTab() {
  return (
    <section aria-labelledby="job-tab-sections-title" className="flex flex-col gap-4">
      <h2 id="job-tab-sections-title" className="text-card-title text-ink">
        Sections
      </h2>
      <LaterPhaseNotice screen="Kept and skipped sections per site" />
    </section>
  );
}

export const Route = createFileRoute("/_app/jobs/$jobId/sections")({
  component: JobSectionsTab,
});
