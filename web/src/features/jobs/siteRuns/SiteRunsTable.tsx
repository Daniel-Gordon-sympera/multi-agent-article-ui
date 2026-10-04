/**
 * Site runs table (mockup §3.5) shared by the Overview section and the Site runs tab, with
 * the Work items drawer (URL `?work=`) and the Exploration dialog wired to the row actions.
 */
import { useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import type { KeysetPageResult } from "@/api/pagination";
import type { JobDetail } from "@/api/types/jobs";
import type { SiteRun } from "@/api/types/siteRuns";
import { DataTable, type DataTableProps } from "@/components/DataTable";
import { useNow } from "@/lib/hooks/useNow";
import { ExplorationDialog } from "./ExplorationDialog";
import { SiteRunsColumnContext } from "./siteRunFacts";
import { SITE_RUN_COLUMNS } from "./siteRunsColumns";
import { WorkItemsDrawer } from "./WorkItemsDrawer";

export interface SiteRunsTableProps {
  job: Pick<JobDetail, "kind">;
  page: KeysetPageResult<SiteRun>;
  tableProps?: Pick<DataTableProps<SiteRun>, "density" | "columnVisibility">;
  withPagination?: boolean;
}

export function SiteRunsTable({
  job,
  page,
  tableProps,
  withPagination = true,
}: SiteRunsTableProps) {
  const navigate = useNavigate();
  const now = useNow(15_000);
  const [exploration, setExploration] = useState<SiteRun | null>(null);
  const facts = useMemo(
    () => ({
      jobKind: job.kind,
      now,
      onWorkItems: (run: SiteRun) =>
        void navigate({
          to: ".",
          search: (previous: Record<string, unknown>) => ({ ...previous, work: run.id }),
        } as never),
      onExploration: setExploration,
    }),
    [job.kind, navigate, now],
  );

  return (
    <>
      <SiteRunsColumnContext.Provider value={facts}>
        <DataTable
          ariaLabel="Site runs"
          columns={SITE_RUN_COLUMNS}
          data={page.items}
          getRowId={(run) => run.id}
          rowHeight={48}
          minWidth={900}
          {...tableProps}
          isLoading={page.query.isPending}
          error={page.query.isError ? page.query.error : undefined}
          onRetry={() => void page.query.refetch()}
          emptyTitle="No site runs yet"
          emptyDescription="Site runs appear once the finder has chosen the seeds (or right away for seed and URL jobs)."
          pagination={withPagination ? { ...page.footer, noun: "site run" } : undefined}
        />
      </SiteRunsColumnContext.Provider>
      <WorkItemsDrawer siteRuns={page.items} />
      <ExplorationDialog run={exploration} onClose={() => setExploration(null)} />
    </>
  );
}
