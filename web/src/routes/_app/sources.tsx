import { createFileRoute } from "@tanstack/react-router";
import { useCallback } from "react";
import { sourcesSearchSchema, type SourcesSearch } from "@/features/sources/searchSchema";
import { SourcesPage } from "@/features/sources/SourcesPage";
import { patchSearch } from "@/lib/url";

function SourcesRoute() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const onSearchChange = useCallback(
    (patch: Partial<SourcesSearch>) =>
      void navigate({ search: (previous) => patchSearch(previous, patch), replace: true }),
    [navigate],
  );
  return <SourcesPage search={search} onSearchChange={onSearchChange} />;
}

export const Route = createFileRoute("/_app/sources")({
  validateSearch: sourcesSearchSchema,
  component: SourcesRoute,
});
