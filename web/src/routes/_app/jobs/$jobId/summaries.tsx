import { createFileRoute } from "@tanstack/react-router";
import { SummariesTab } from "@/features/jobs/results/SummariesTab";
import { useTabHandlers } from "@/features/jobs/shared/useTabHandlers";
import {
  summariesTabSearchSchema,
  type SummariesTabSearch,
} from "@/features/jobs/tabSearchSchemas";

function JobSummariesTab() {
  const { jobId } = Route.useParams();
  const search = Route.useSearch();
  const handlers = useTabHandlers<SummariesTabSearch>(Route.useNavigate());
  return <SummariesTab jobId={jobId} search={search} {...handlers} />;
}

export const Route = createFileRoute("/_app/jobs/$jobId/summaries")({
  validateSearch: summariesTabSearchSchema,
  component: JobSummariesTab,
});
