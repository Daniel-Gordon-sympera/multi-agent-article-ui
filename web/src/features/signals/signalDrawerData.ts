/**
 * Pure helpers of the signal drawer: evidence checks from the row's `checks`, the "across
 * jobs" counts of a company profile, the header location line and the confidence label.
 */
import type { EvidenceCheck } from "@/components/EvidenceQuote";
import type { CompanyProfile } from "@/api/types/companies";
import type { SignalRow } from "@/api/types/signals";
import { formatLocation, formatScore } from "@/lib/format";
import type { SignalTableRow } from "./signalColumns";

const CHECK_LABELS: Array<[matcher: RegExp, label: string]> = [
  [/verbatim/i, "verbatim match"],
  [/name[_ ]?grounded|grounded/i, "name grounded"],
  [/quote/i, "quote located"],
  [/date/i, "date verified"],
];

function labelOf(check: string): string {
  for (const [matcher, label] of CHECK_LABELS) if (matcher.test(check)) return label;
  return check.replace(/_/g, " ");
}

/**
 * `checks` is `text[]` in the pipeline (`["verbatim_match", "name_grounded"]`); older rows may
 * carry an object (`{verbatim: true}`). Both become labelled checks; unknown shapes → none.
 */
export function evidenceChecks(checks: unknown): EvidenceCheck[] {
  if (Array.isArray(checks)) {
    return checks
      .filter((c): c is string => typeof c === "string" && c.trim() !== "")
      .map((c) => ({ label: labelOf(c), ok: true }));
  }
  if (checks && typeof checks === "object") {
    return Object.entries(checks as Record<string, unknown>)
      .filter(([, value]) => typeof value === "boolean")
      .map(([key, value]) => ({ label: labelOf(key), ok: value === true }));
  }
  return [];
}

export interface AcrossJobsCounts {
  mentions: number;
  jobs: number | null;
  signals: number;
  more: boolean;
}

function jobIdOf(row: SignalRow): string | null {
  const record = row as unknown as Record<string, unknown>;
  const candidate = record.job_id ?? record.first_job_id;
  return typeof candidate === "string" && candidate ? candidate : null;
}

/** "3 mentions in 2 jobs · 2 signals" — jobs only when the rows carry a job id. */
export function acrossJobsCounts(profile: CompanyProfile): AcrossJobsCounts {
  const mentions = profile.mentions?.items ?? [];
  const signals = profile.signals?.items ?? [];
  const jobIds = new Set<string>();
  for (const row of [...mentions, ...signals]) {
    const id = jobIdOf(row);
    if (id) jobIds.add(id);
  }
  return {
    mentions: mentions.length,
    jobs: jobIds.size > 0 ? jobIds.size : null,
    signals: signals.length,
    more: Boolean(profile.mentions?.next_cursor || profile.signals?.next_cursor),
  };
}

export function formatAcrossJobs(counts: AcrossJobsCounts): string {
  const suffix = counts.more ? "+" : "";
  const mentions = `${counts.mentions}${suffix} mention${counts.mentions === 1 ? "" : "s"}`;
  const jobs = counts.jobs === null ? "" : ` in ${counts.jobs} job${counts.jobs === 1 ? "" : "s"}`;
  const signals = `${counts.signals}${suffix} signal${counts.signals === 1 ? "" : "s"}`;
  return `${mentions}${jobs} · ${signals}`;
}

export interface DrawerJobContext {
  county: string | null | undefined;
  stateCode: string | null | undefined;
  industry: string | null | undefined;
}

/** "Orange County, FL · Construction" from the row's job columns or the tab's job. */
export function drawerLocationLine(row: SignalTableRow, job?: DrawerJobContext | null): string {
  const county = job?.county ?? row.county ?? row.hq_county;
  const state = job?.stateCode ?? row.state_code ?? row.hq_state;
  const industry = job?.industry ?? row.job_industry ?? row.company_industry;
  const location = formatLocation(county, state);
  return [location === "—" ? null : location, industry].filter(Boolean).join(" · ");
}

/** "0.92 · high". */
export function confidenceLabel(row: Pick<SignalRow, "confidence_score" | "confidence_level">) {
  const score = formatScore(row.confidence_score);
  return row.confidence_level ? `${score} · ${row.confidence_level}` : score;
}

/** The state to ask `/v1/companies/{key}` for: the row's HQ state, else the job's state. */
export function companyStateFor(
  row: SignalTableRow,
  job?: DrawerJobContext | null,
): string | undefined {
  const candidate = (row.hq_state || job?.stateCode || row.state_code || "").trim().toUpperCase();
  return candidate || undefined;
}
