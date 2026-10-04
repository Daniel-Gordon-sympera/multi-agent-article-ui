/** Flag rows (`GET /v1/jobs/{id}/flags`) and company profiles (`GET /v1/companies/{key}`). */
import type { IsoDate, IsoDateTime, JsonValue, Page, Uuid } from "./common";
import type { EntityFlag, HqScope, OrgKind, SignalRow } from "./signals";

/** `analysis.job_company_flags` + `company_name, company_key, articles`. */
export interface FlagRow {
  job_id: Uuid;
  company_id: number;
  state_code: string;
  enrichment_version: string;
  authoritative: boolean;
  org_kind: OrgKind;
  org_kind_basis: string;
  hq_county: string;
  hq_state: string;
  scope_place: string;
  scope_basis: string;
  company_industry: string;
  company_sub_industry: string;
  industry_basis: string;
  revenue_bin: string;
  revenue_basis: string;
  revenue_confidence: number | string;
  enrichment_source: string;
  place_hints: JsonValue[];
  size_cues: JsonValue[];
  warnings: string[];
  evidence_articles: number;
  known_count: number;
  updated_at: IsoDateTime;
  hq_scope: HqScope;
  entity_flag: EntityFlag;
  company_name: string;
  company_key: string;
  articles: number;
}

export interface FlagListFilters {
  org_kind?: string;
  hq_scope?: string;
  revenue_bin?: string;
}

/** `analysis.companies` row. */
export interface Company {
  id: number;
  company_key: string;
  state_code: string;
  name: string;
  first_seen: IsoDateTime;
  last_seen: IsoDateTime;
}

export interface CompanyArticle {
  id: number;
  canonical_url: string;
  domain: string;
  title: string;
  published_date: IsoDate;
  [extra: string]: unknown;
}

/** `GET /v1/companies/{company_key}?state=` — profile with paged sub-lists. */
export interface CompanyProfile extends Company {
  flags: Omit<
    FlagRow,
    "job_id" | "hq_scope" | "entity_flag" | "company_name" | "company_key" | "articles"
  > | null;
  mentions: Page<SignalRow>;
  signals: Page<SignalRow>;
  articles: Page<CompanyArticle>;
}

/** `409 company_state_required` carries the candidate states. */
export interface CompanyStateRequired {
  states: string[];
}
