/**
 * Overview (`/`, mockup §3.1): header with New run + Refresh, four tiles, then Active runs +
 * Recent signals at the left and Needs attention + Workers at the right.
 */
import { Link } from "@tanstack/react-router";
import { Plus, RefreshCw } from "lucide-react";
import { useSession } from "@/app/providers/SessionProvider";
import { Button } from "@/components/Button";
import { PageHeader } from "@/components/PageHeader";
import { ActiveRunsTable } from "./ActiveRunsTable";
import { AttentionCard } from "./AttentionCard";
import { OverviewTiles } from "./OverviewTiles";
import { RecentSignalsCard } from "./RecentSignalsCard";
import {
  useActiveRuns,
  useAttention,
  useOverviewSummary,
  useOverviewWorkers,
  useRecentSignals,
  useRefreshOverview,
} from "./useOverviewQueries";
import { WorkersCard } from "./WorkersCard";

export function OverviewPage() {
  const { can } = useSession();
  const summary = useOverviewSummary();
  const runs = useActiveRuns();
  const attention = useAttention();
  const workers = useOverviewWorkers();
  const signals = useRecentSignals();
  const refresh = useRefreshOverview();

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
            <Button
              variant="secondary"
              onClick={() => refresh.mutate()}
              loading={refresh.isPending}
              aria-label="Refresh the overview"
            >
              <RefreshCw aria-hidden />
              Refresh
            </Button>
          </>
        }
      />
      <OverviewTiles
        summary={summary.data}
        loading={summary.isPending}
        error={summary.error}
        onRetry={() => void summary.refetch()}
      />
      <div className="flex flex-wrap items-start gap-5">
        <div className="flex min-w-0 flex-[999_1_640px] flex-col gap-5">
          <ActiveRunsTable
            runs={runs.data}
            loading={runs.isPending}
            error={runs.error}
            onRetry={() => void runs.refetch()}
          />
          <RecentSignalsCard
            signals={signals.data}
            loading={signals.isPending}
            error={signals.error}
            onRetry={() => void signals.refetch()}
          />
        </div>
        <div className="flex min-w-0 flex-[1_1_320px] flex-col gap-5">
          <AttentionCard
            items={attention.data}
            loading={attention.isPending}
            error={attention.error}
            onRetry={() => void attention.refetch()}
          />
          <WorkersCard
            workers={workers.data}
            loading={workers.isPending}
            error={workers.error}
            onRetry={() => void workers.refetch()}
          />
        </div>
      </div>
    </>
  );
}
