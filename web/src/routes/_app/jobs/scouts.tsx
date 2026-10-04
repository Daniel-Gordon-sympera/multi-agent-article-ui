import { createFileRoute } from "@tanstack/react-router";
import { useCallback } from "react";
import { scoutsSearchSchema, type ScoutsSearch } from "@/features/jobs/searchSchemas";
import { ScoutsPage } from "@/features/scouts/ScoutsPage";
import { patchSearch } from "@/lib/url";

function ScoutsRoute() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const onSearchChange = useCallback(
    (patch: Partial<ScoutsSearch>) =>
      void navigate({ search: (previous) => patchSearch(previous, patch), replace: true }),
    [navigate],
  );
  return <ScoutsPage search={search} onSearchChange={onSearchChange} />;
}

export const Route = createFileRoute("/_app/jobs/scouts")({
  validateSearch: scoutsSearchSchema,
  component: ScoutsRoute,
});
