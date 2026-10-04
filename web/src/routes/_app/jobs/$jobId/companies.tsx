import { createFileRoute } from "@tanstack/react-router";
import { CompaniesTab } from "@/features/jobs/results/CompaniesTab";
import { useTabHandlers } from "@/features/jobs/shared/useTabHandlers";
import {
  companiesTabSearchSchema,
  type CompaniesTabSearch,
} from "@/features/jobs/tabSearchSchemas";

function JobCompaniesTab() {
  const { jobId } = Route.useParams();
  const search = Route.useSearch();
  const handlers = useTabHandlers<CompaniesTabSearch>(Route.useNavigate());
  return <CompaniesTab jobId={jobId} search={search} {...handlers} />;
}

export const Route = createFileRoute("/_app/jobs/$jobId/companies")({
  validateSearch: companiesTabSearchSchema,
  component: JobCompaniesTab,
});
