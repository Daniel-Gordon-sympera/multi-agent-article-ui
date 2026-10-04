import { createFileRoute } from "@tanstack/react-router";
import { LaterPhaseNotice } from "@/features/placeholder/LaterPhaseNotice";

function JobTasksTab() {
  return (
    <section aria-labelledby="job-tab-tasks-title" className="flex flex-col gap-4">
      <h2 id="job-tab-tasks-title" className="text-card-title text-ink">
        Tasks
      </h2>
      <LaterPhaseNotice screen="The task tree with retry for dead tasks" />
    </section>
  );
}

export const Route = createFileRoute("/_app/jobs/$jobId/tasks")({
  component: JobTasksTab,
});
