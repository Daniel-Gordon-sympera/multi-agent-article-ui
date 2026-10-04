/**
 * Signal / company-mention rows of `GET /v1/jobs/{id}/signals` and `/companies`:
 * analysis.company_mentions joined with the article, the company and its job-relative flags
 * (contract §1). `/companies` returns the same shape with `signal` possibly null.
 */
import type { IsoDate, Uuid } from "./common";

export type OrgKind = "business" | "gov" | "nonprofit" | "unknown" | string;
export type HqScope = "local" | "state" | "national" | "unknown" | string;
export type EntityFlag =
  "local" | "state" | "nationwide" | "gov" | "non-profit" | "unknown" | string;
export type ConfidenceLevel = "high" | "medium" | "low" | string;

export interface SignalRow {
  id: number;
  summary_id: number;
  article_id: number;
  company_id: number;
  number_company: number;
  name_as_written: string;
  entity_type: string;
  role: string;
  quote_id: number;
  evidence: string;
  confidence_score: number | string;
  confidence_level: ConfidenceLevel;
  checks: string[];
  signal: string | null;
  signal_title: string | null;
  materiality: string | null;
  connection: string | null;
  signal_quote_id: number | null;
  signal_evidence: string | null;
  // article
  url: string;
  title: string;
  date: IsoDate;
  source_domain: string;
  article_key: string;
  // company
  company_key: string;
  company: string;
  confidence: string | number | null;
  fetch_status: string | null;
  // job-relative flags
  org_kind: OrgKind;
  org_kind_basis: string;
  hq_scope: HqScope;
  entity_flag: EntityFlag;
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
}

export type CompanyMentionRow = SignalRow;

export interface SignalListFilters {
  signal?: string;
  materiality?: string;
  company_key?: string;
  hq_scope?: string;
  org_kind?: string;
}

export interface CompanyListFilters {
  company_key?: string;
  org_kind?: string;
  hq_scope?: string;
  industry?: string;
}

/** A signal row as returned by the BFF's cross-job read (`GET /app/signals`, §4.4). */
export interface CrossJobSignalRow extends SignalRow {
  job_id: Uuid;
  county: string;
  state_code: string;
  job_industry: string | null;
  job_created_at: string;
}
