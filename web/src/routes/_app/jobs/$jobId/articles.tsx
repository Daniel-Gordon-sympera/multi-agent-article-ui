import { createFileRoute } from "@tanstack/react-router";
import { ArticlesTab } from "@/features/jobs/results/ArticlesTab";
import { useTabHandlers } from "@/features/jobs/shared/useTabHandlers";
import { articlesTabSearchSchema, type ArticlesTabSearch } from "@/features/jobs/tabSearchSchemas";

function JobArticlesTab() {
  const { jobId } = Route.useParams();
  const search = Route.useSearch();
  const handlers = useTabHandlers<ArticlesTabSearch>(Route.useNavigate());
  return <ArticlesTab jobId={jobId} search={search} {...handlers} />;
}

export const Route = createFileRoute("/_app/jobs/$jobId/articles")({
  validateSearch: articlesTabSearchSchema,
  component: JobArticlesTab,
});
