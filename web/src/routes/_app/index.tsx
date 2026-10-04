import { createFileRoute, Link } from "@tanstack/react-router";
import { Plus, RefreshCw } from "lucide-react";
import { useSession } from "@/app/providers/SessionProvider";
import { Button } from "@/components/Button";
import { PageHeader } from "@/components/PageHeader";
import { LaterPhaseNotice } from "@/features/placeholder/LaterPhaseNotice";

function OverviewPage() {
  const { can } = useSession();
  return (
    <>
      <PageHeader
        title="Overview"
        subtitle="Everything running right now, and what needs you"
        actions={
          <>
            {can("operate") ? (
              <Button asChild variant="primary">
                <Link to="/jobs/new">
                  <Plus aria-hidden />
                  New run
                </Link>
              </Button>
            ) : null}
            <Button variant="secondary" disabled>
              <RefreshCw aria-hidden />
              Refresh
            </Button>
          </>
        }
      />
      <LaterPhaseNotice screen="The overview with its KPI tiles, active runs, attention items and workers" />
    </>
  );
}

export const Route = createFileRoute("/_app/")({
  component: OverviewPage,
});
