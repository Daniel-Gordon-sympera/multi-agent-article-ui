import { createFileRoute, Link } from "@tanstack/react-router";
import { Download, Plus, Save } from "lucide-react";
import { useSession } from "@/app/providers/SessionProvider";
import { Button } from "@/components/Button";
import { PageHeader } from "@/components/PageHeader";
import { signalsSearchSchema } from "@/features/signals/searchSchema";
import { LaterPhaseNotice } from "@/features/placeholder/LaterPhaseNotice";

function SignalsPage() {
  const { can } = useSession();
  return (
    <>
      <PageHeader
        title="Signals"
        subtitle="Every signal detected across jobs, with the evidence behind it"
        actions={
          <>
            <Button variant="secondary" disabled>
              <Download aria-hidden />
              Export CSV
            </Button>
            <Button variant="secondary" disabled>
              <Save aria-hidden />
              Save view
            </Button>
            {can("operate") ? (
              <Button asChild variant="primary">
                <Link to="/jobs/new">
                  <Plus aria-hidden />
                  New run
                </Link>
              </Button>
            ) : null}
          </>
        }
      />
      <LaterPhaseNotice screen="The cross-job signals explorer with its filters, saved views and detail drawer" />
    </>
  );
}

export const Route = createFileRoute("/_app/signals")({
  validateSearch: signalsSearchSchema,
  component: SignalsPage,
});
