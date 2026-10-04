/** Cells of the Site runs table; job kind, clock and handlers come from `SiteRunsColumnContext`. */
import type { SiteRun } from "@/api/types/siteRuns";
import { Button } from "@/components/Button";
import { formatDuration } from "@/lib/format";
import { SiteRunsColumnContext, siteRunDuration, siteRunOrigin } from "./siteRunFacts";

export function SiteCell({ run }: { run: SiteRun }) {
  const { jobKind } = SiteRunsColumnContext.useColumnContext();
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <a
        href={run.seed_url}
        target="_blank"
        rel="noopener noreferrer"
        className="truncate font-semibold text-ink hover:text-brand-700"
      >
        {run.domain}
      </a>
      <span className="text-[12px] text-muted">{siteRunOrigin(run, jobKind)}</span>
    </div>
  );
}

export function DurationCell({ run }: { run: SiteRun }) {
  const { now } = SiteRunsColumnContext.useColumnContext();
  return <>{formatDuration(siteRunDuration(run, now))}</>;
}

export function ActionsCell({ run }: { run: SiteRun }) {
  const { onWorkItems, onExploration } = SiteRunsColumnContext.useColumnContext();
  return (
    <div className="flex items-center justify-end gap-1">
      <Button
        variant="secondary"
        size="xs"
        onClick={() => onWorkItems(run)}
        aria-label={`Work items of ${run.domain}`}
      >
        Work items
      </Button>
      <Button
        variant="ghost"
        size="xs"
        onClick={() => onExploration(run)}
        aria-label={`Exploration of ${run.domain}`}
      >
        Exploration
      </Button>
    </div>
  );
}
