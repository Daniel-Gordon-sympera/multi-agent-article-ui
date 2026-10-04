/** Job wording shared by tables, headers and the palette: "Orange County, FL · Construction". */
import type { JobKind, JobRecord } from "@/api/types/jobs";
import { formatLocation } from "@/lib/format";
import { domainOf } from "@/lib/url";

type JobLike = Pick<JobRecord, "kind" | "input" | "county" | "state_code">;

/** The industry of a location_industry job, else null. */
export function jobIndustry(job: Pick<JobRecord, "kind" | "input">): string | null {
  const industry = job.input?.industry;
  return typeof industry === "string" && industry.trim() ? industry : null;
}

/** What the job targets: the industry, the site domain or "N seeds". */
export function jobTarget(job: Pick<JobRecord, "kind" | "input">): string {
  const industry = jobIndustry(job);
  if (industry) return industry;
  if (job.kind === "url" && typeof job.input?.url === "string")
    return domainOf(job.input.url) || job.input.url;
  if (job.kind === "seeds") {
    const count = Array.isArray(job.input?.seeds) ? job.input.seeds.length : 0;
    return count === 1 ? "1 seed" : `${count} seeds`;
  }
  return job.kind;
}

export function jobTitle(job: JobLike): string {
  return `${formatLocation(job.county, job.state_code)} · ${jobTarget(job)}`;
}

/** Table wording of the kind (mockup §3.2): "location + industry" | "seeds" | "url". */
export const JOB_KIND_LABELS: Record<JobKind, string> = {
  location_industry: "location + industry",
  seeds: "seeds",
  url: "url",
};

export function jobKindLabel(kind: JobKind | string): string {
  return JOB_KIND_LABELS[kind as JobKind] ?? kind;
}
