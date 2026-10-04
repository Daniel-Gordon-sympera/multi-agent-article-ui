import { createFileRoute } from "@tanstack/react-router";
import { SectionsTab } from "@/features/jobs/sections/SectionsTab";
import { useTabHandlers } from "@/features/jobs/shared/useTabHandlers";
import { sectionsTabSearchSchema, type SectionsTabSearch } from "@/features/jobs/tabSearchSchemas";

function JobSectionsTab() {
  const { jobId } = Route.useParams();
  const search = Route.useSearch();
  const handlers = useTabHandlers<SectionsTabSearch>(Route.useNavigate());
  return <SectionsTab jobId={jobId} search={search} {...handlers} />;
}

export const Route = createFileRoute("/_app/jobs/$jobId/sections")({
  validateSearch: sectionsTabSearchSchema,
  component: JobSectionsTab,
});
