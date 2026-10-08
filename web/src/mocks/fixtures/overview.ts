/**
 * Overview fixtures (mockup §3.1): the "Recent signals" list order and the fallback cross-job
 * rows served by `handlers/overview.ts` when no other handler answers `GET /app/signals`.
 * (B3's full `/app/signals` handler is registered first and wins after the merge.)
 */
import type { CrossJobSignalRow } from "@/api/types/signals";
import type { MockDatabase } from "@/mocks/db";
import { signalJobId } from "./signals";

/** Newest first, as drawn: Lakeview · Bayou Steel · Central Florida Concrete · Front Range · Peachtree. */
export const RECENT_SIGNAL_COMPANIES = [
  "Lakeview Builders Group",
  "Bayou Steel Works",
  "Central Florida Concrete",
  "Front Range Builders",
  "Peachtree Distribution",
] as const;

export function toCrossJobRow(
  row: MockDatabase["signals"][number],
  jobs: MockDatabase["jobs"],
): CrossJobSignalRow {
  const jobId = signalJobId(row);
  const job = jobs.find((j) => j.id === jobId);
  return {
    ...row,
    job_id: jobId,
    county: job?.county ?? "Orange",
    state_code: job?.state_code ?? "FL",
    job_industry: typeof job?.input.industry === "string" ? job.input.industry : null,
    job_created_at: job?.created_at ?? row.date ?? "",
    client_reference: job?.client_reference ?? null,
  };
}

/** The mockup's five rows first (when present), then everything else newest first. */
export function buildRecentSignalRows(database: MockDatabase): CrossJobSignalRow[] {
  const rows = database.signals.map((row) => toCrossJobRow(row, database.jobs));
  const named = RECENT_SIGNAL_COMPANIES.map((company) =>
    rows.find((row) => row.company === company),
  ).filter((row): row is CrossJobSignalRow => row !== undefined);
  const rest = rows
    .filter((row) => !named.includes(row))
    .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? "") || b.id - a.id);
  return [...named, ...rest];
}
