/** Derived facts of a site run row: its origin wording and its duration. */
import type { JobKind } from "@/api/types/jobs";
import type { SiteRun } from "@/api/types/siteRuns";
import { createColumnContext } from "@/features/jobs/shared/columnContext";
import { formatInteger, secondsBetween } from "@/lib/format";

export interface SiteRunsColumnFacts {
  jobKind: JobKind;
  now: Date;
  onWorkItems: (run: SiteRun) => void;
  onExploration: (run: SiteRun) => void;
}

/** Changing facts (job kind, the clock, the handlers) reach the cells without rebuilding columns. */
export const SiteRunsColumnContext = createColumnContext<SiteRunsColumnFacts>("Site runs");

/** "rank 1 · finder" for finder jobs, "seed 2" otherwise. */
export function siteRunOrigin(run: SiteRun, jobKind: JobKind): string {
  if (jobKind === "location_industry") return `rank ${run.rank ?? "—"} · finder`;
  if (jobKind === "url") return "site URL";
  return `seed ${run.rank ?? "—"}`;
}

export function siteRunDuration(run: SiteRun, now: Date): number | null {
  if (!run.started_at) return null;
  return secondsBetween(run.started_at, run.finished_at, now);
}

/** Integer stats cell; "—" when the engine has not reported the figure. */
export function formatCount(value: unknown): string {
  return typeof value === "number" ? formatInteger(value) : "—";
}
