import { createFileRoute } from "@tanstack/react-router";
import { Plus, Upload } from "lucide-react";
import { useSession } from "@/app/providers/SessionProvider";
import { Button } from "@/components/Button";
import { PageHeader } from "@/components/PageHeader";
import { sourcesSearchSchema } from "@/features/sources/searchSchema";
import { LaterPhaseNotice } from "@/features/placeholder/LaterPhaseNotice";

function SourcesPage() {
  const { can } = useSession();
  return (
    <>
      <PageHeader
        title="Data Sources"
        subtitle="Curated news sites used as seeds, fed by what the finder discovers"
        actions={
          can("operate") ? (
            <>
              <Button variant="primary" disabled>
                <Plus aria-hidden />
                Add source
              </Button>
              <Button variant="secondary" disabled>
                <Upload aria-hidden />
                Import CSV
              </Button>
            </>
          ) : undefined
        }
      />
      <LaterPhaseNotice screen="The curated source list, its tiles and the finder suggestions" />
    </>
  );
}

export const Route = createFileRoute("/_app/sources")({
  validateSearch: sourcesSearchSchema,
  component: SourcesPage,
});
