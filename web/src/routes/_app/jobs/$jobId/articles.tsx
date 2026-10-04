import { createFileRoute } from "@tanstack/react-router";
import { LaterPhaseNotice } from "@/features/placeholder/LaterPhaseNotice";

function JobArticlesTab() {
  return (
    <section aria-labelledby="job-tab-articles-title" className="flex flex-col gap-4">
      <h2 id="job-tab-articles-title" className="text-card-title text-ink">
        Articles
      </h2>
      <LaterPhaseNotice screen="Accepted articles and their saved text" />
    </section>
  );
}

export const Route = createFileRoute("/_app/jobs/$jobId/articles")({
  component: JobArticlesTab,
});
