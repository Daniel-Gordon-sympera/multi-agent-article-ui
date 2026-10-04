import { createFileRoute } from "@tanstack/react-router";
import { useTabHandlers } from "@/features/jobs/shared/useTabHandlers";
import { tasksTabSearchSchema, type TasksTabSearch } from "@/features/jobs/tabSearchSchemas";
import { TasksTab } from "@/features/jobs/tasks/TasksTab";

function JobTasksTab() {
  const { jobId } = Route.useParams();
  const search = Route.useSearch();
  const handlers = useTabHandlers<TasksTabSearch>(Route.useNavigate());
  return <TasksTab jobId={jobId} search={search} {...handlers} />;
}

export const Route = createFileRoute("/_app/jobs/$jobId/tasks")({
  validateSearch: tasksTabSearchSchema,
  component: JobTasksTab,
});
