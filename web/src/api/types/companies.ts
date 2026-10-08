import type { components } from "../pipeline.gen";
/** Flag rows (`GET /v1/jobs/{id}/flags`) and company profiles (`GET /v1/companies/{key}`). */

/** `analysis.job_company_flags` + `company_name, company_key, articles`. */
export type FlagRow = components["schemas"]["CompanyFlags"];

export interface FlagListFilters {
  org_kind?: string;
  hq_scope?: string;
  revenue_bin?: string;
}

/** `analysis.companies` row. */
export type Company = Pick<
  components["schemas"]["CompanyProfile"],
  "id" | "company_key" | "state_code" | "name" | "first_seen" | "last_seen"
>;

export type CompanyArticle = components["schemas"]["ArticleRow"];

/** `GET /v1/companies/{company_key}?state=` — profile with paged sub-lists. */
/** Profile mentions are raw backend records, not enriched per-job signal rows. */
export type CompanyProfileMention = components["schemas"]["CompanyMention"];

export type CompanyProfile = components["schemas"]["CompanyProfile"];

/** `409 company_state_required` carries the candidate states. */
export interface CompanyStateRequired {
  states: string[];
}
