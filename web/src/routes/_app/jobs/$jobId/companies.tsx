import { createFileRoute } from "@tanstack/react-router";
import { LaterPhaseNotice } from "@/features/placeholder/LaterPhaseNotice";

function JobCompaniesTab() {
  return (
    <section aria-labelledby="job-tab-companies-title" className="flex flex-col gap-4">
      <h2 id="job-tab-companies-title" className="text-card-title text-ink">
        Companies
      </h2>
      <LaterPhaseNotice screen="Companies and their enrichment flags" />
    </section>
  );
}

export const Route = createFileRoute("/_app/jobs/$jobId/companies")({
  component: JobCompaniesTab,
});
