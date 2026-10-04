/**
 * Pure helpers behind the Scouts table (mockup §3.3): location wording, the Sources column,
 * the aggregated status of the last run, the fan-out size and the client-side filters.
 */
import type { ScoutLastRun, ScoutWithRuns, Source } from "@/api/types/bff";
import type { JobStatus } from "@/api/types/jobs";
import type { ScoutsSearch } from "@/features/jobs/searchSchemas";
import { formatLocation } from "@/lib/format";
import { isTerminalJobStatus } from "@/lib/status";

export const DEFAULT_SITES = 5;

export function scoutLocation(scout: Pick<ScoutWithRuns, "county" | "state_code">): string {
  return formatLocation(scout.county, scout.state_code);
}

function normaliseCounty(value: string): string {
  return value
    .trim()
    .replace(/\s+county$/i, "")
    .toLowerCase();
}

/** Active sources a seed run of this Scout would use (same rule as the BFF fan-out). */
export function seedSourcesFor(
  scout: Pick<ScoutWithRuns, "county" | "state_code" | "industries">,
  sources: readonly Source[],
): Source[] {
  const county = normaliseCounty(scout.county);
  const state = scout.state_code.toUpperCase();
  const wanted = scout.industries.map((i) => i.toLowerCase());
  return sources.filter(
    (source) =>
      source.status === "active" &&
      normaliseCounty(source.county) === county &&
      source.state_code.toUpperCase() === state &&
      (wanted.length === 0 ||
        source.industries.length === 0 ||
        source.industries.some((i) => wanted.includes(i.toLowerCase()))),
  );
}

/** "Finder · top 5 sites" or "4 seeds from Data Sources" (mockup §3.3 col. 3). */
export function sourcesLabel(scout: ScoutWithRuns, sources: readonly Source[] | undefined): string {
  if (scout.source_mode === "seeds" || scout.kind === "seeds") {
    if (sources === undefined) return "seeds from Data Sources";
    const count = seedSourcesFor(scout, sources).length;
    return `${count} ${count === 1 ? "seed" : "seeds"} from Data Sources`;
  }
  if (scout.kind === "url") return scout.url ? "Site URL" : "Site URL · not set";
  const sites = scout.settings.sites ?? DEFAULT_SITES;
  return `Finder · top ${sites} ${sites === 1 ? "site" : "sites"}`;
}

/** How many API jobs one run creates: one per industry, else a single leg. */
export function jobsToCreate(scout: Pick<ScoutWithRuns, "kind" | "industries">): number {
  return scout.kind === "location_industry" ? Math.max(1, scout.industries.length) : 1;
}

const STAGE_ORDER: readonly JobStatus[] = [
  "queued",
  "finding",
  "exploring",
  "discovering",
  "analysing",
  "finalizing",
  "cancelling",
];

/**
 * One status for a batch: while any job runs, the furthest stage; once every job finished,
 * Completed when all did, Partial for a mix, Failed/Cancelled when nothing completed.
 */
export function lastRunStatus(lastRun: ScoutLastRun | null): JobStatus | null {
  if (!lastRun || lastRun.jobs.length === 0) return null;
  const statuses = lastRun.jobs.map((job) => job.status).filter((s): s is JobStatus => !!s);
  if (statuses.length === 0) return null;
  const active = statuses.filter((status) => !isTerminalJobStatus(status));
  if (active.length > 0) {
    return active.reduce<JobStatus>(
      (best, status) => (STAGE_ORDER.indexOf(status) > STAGE_ORDER.indexOf(best) ? status : best),
      active[0]!,
    );
  }
  if (statuses.every((status) => status === "completed")) return "completed";
  if (statuses.some((status) => status === "completed" || status === "partial")) return "partial";
  if (statuses.some((status) => status === "failed")) return "failed";
  return "cancelled";
}

export function filterScouts(
  scouts: readonly ScoutWithRuns[],
  search: Pick<ScoutsSearch, "state" | "industry" | "q">,
): ScoutWithRuns[] {
  const q = search.q?.trim().toLowerCase();
  return scouts.filter((scout) => {
    if (search.state && scout.state_code.toUpperCase() !== search.state.toUpperCase()) return false;
    if (
      search.industry &&
      !scout.industries.some((i) => i.toLowerCase() === search.industry!.toLowerCase())
    )
      return false;
    if (q) {
      const haystack = [scout.name, scout.county, scout.state_code, scout.location ?? ""]
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });
}

export function scoutStateOptions(scouts: readonly ScoutWithRuns[]): string[] {
  return [...new Set(scouts.map((s) => s.state_code.toUpperCase()))].sort();
}

export function scoutIndustryOptions(scouts: readonly ScoutWithRuns[]): string[] {
  return [...new Set(scouts.flatMap((s) => s.industries))].sort((a, b) => a.localeCompare(b));
}
