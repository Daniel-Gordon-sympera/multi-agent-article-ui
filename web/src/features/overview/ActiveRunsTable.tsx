/**
 * Active runs — mockup §3.1: Job (title + short id + batch tag) · Status · Stages · Sites ·
 * Signals · Cost, rows 48, `aria-label="Active runs"`, with "All jobs ›" in the section title.
 */
import { Link } from "@tanstack/react-router";
import type { ColumnDef } from "@tanstack/react-table";
import { Plus } from "lucide-react";
import { useMemo } from "react";
import type { BatchMembership } from "@/api/types/bff";
import type { ActiveRun } from "@/api/types/overview";
import { useSession } from "@/app/providers/SessionProvider";
import { Button } from "@/components/Button";
import { SectionHeader } from "@/components/Card";
import { DataTable } from "@/components/DataTable";
import { EmptyState } from "@/components/EmptyState";
import { StageBar } from "@/components/StageBar";
import { StatusPill } from "@/components/StatusPill";
import { Tag } from "@/components/Tag";
import { TextLink } from "@/components/TextLink";
import { jobTitle } from "@/features/jobs/jobTitle";
import { useBatchMembership } from "@/features/jobs/useJobQueries";
import { shortId } from "@/lib/format";
import { formatRunCost, formatSignals, formatSites } from "./overviewFormat";

function buildColumns(batches: Record<string, BatchMembership>): ColumnDef<ActiveRun, unknown>[] {
  return [
    {
      id: "job",
      header: "Job",
      meta: { hideable: false, minWidth: 260 },
      cell: ({ row }) => {
        const run = row.original;
        const membership = batches[run.id];
        return (
          <div className="flex min-w-0 flex-col gap-0.5">
            <Link
              to="/jobs/$jobId"
              params={{ jobId: run.id }}
              className="truncate font-semibold text-ink no-underline hover:text-ink hover:underline"
            >
              {jobTitle(run)}
            </Link>
            <span className="flex items-center gap-1.5 text-[12px] text-muted">
              <span className="font-mono">{shortId(run.id)}</span>
              {membership && membership.size > 1 ? (
                <>
                  <span aria-hidden>·</span>
                  <Tag tone="brand">
                    batch {membership.position} of {membership.size}
                  </Tag>
                </>
              ) : null}
            </span>
          </div>
        );
      },
    },
    {
      id: "status",
      header: "Status",
      meta: { width: 140 },
      cell: ({ row }) => <StatusPill entity="job" status={row.original.status} />,
    },
    {
      id: "stages",
      header: "Stages",
      meta: { width: 110 },
      cell: ({ row }) => (
        <StageBar
          status={row.original.status}
          stopReason={row.original.stop_reason}
          progress={row.original.progress ?? undefined}
        />
      ),
    },
    {
      id: "sites",
      header: "Sites",
      meta: { align: "right", width: 90 },
      cell: ({ row }) => formatSites(row.original.sites),
    },
    {
      id: "signals",
      header: "Signals",
      meta: { align: "right", width: 90 },
      cell: ({ row }) => formatSignals(row.original),
    },
    {
      id: "cost",
      header: "Cost",
      meta: { align: "right", width: 90 },
      cell: ({ row }) => formatRunCost(row.original),
    },
  ];
}

export interface ActiveRunsTableProps {
  runs: ActiveRun[] | undefined;
  loading: boolean;
  error: unknown;
  onRetry: () => void;
}

export function ActiveRunsTable({ runs, loading, error, onRetry }: ActiveRunsTableProps) {
  const { can } = useSession();
  const ids = useMemo(() => (runs ?? []).map((run) => run.id), [runs]);
  const batchesQuery = useBatchMembership(ids);
  const columns = useMemo(
    () => buildColumns(batchesQuery.data?.batches ?? {}),
    [batchesQuery.data],
  );
  return (
    <section aria-labelledby="active-runs-title" className="flex flex-col gap-3">
      <SectionHeader
        title={<span id="active-runs-title">Active runs</span>}
        aside={
          <TextLink asChild chevron>
            <Link to="/jobs">All jobs</Link>
          </TextLink>
        }
      />
      <DataTable<ActiveRun>
        ariaLabel="Active runs"
        columns={columns}
        data={runs}
        getRowId={(run) => run.id}
        rowHeight={48}
        minWidth={640}
        isLoading={loading && !runs}
        error={runs ? undefined : error}
        onRetry={onRetry}
        emptyState={
          <EmptyState
            variant="plain"
            title="Nothing is running"
            description="Queued and running jobs appear here the moment they start."
            action={
              can("operate") ? (
                <Button asChild variant="primary" size="sm">
                  <Link to="/jobs/new">
                    <Plus aria-hidden />
                    New run
                  </Link>
                </Button>
              ) : undefined
            }
          />
        }
      />
    </section>
  );
}
