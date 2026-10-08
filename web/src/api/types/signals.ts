import type { components } from "../pipeline.gen";
/**
 * Signal / company-mention rows of `GET /v1/jobs/{id}/signals` and `/companies`:
 * analysis.company_mentions joined with the article, the company and its job-relative flags
 * (contract §1). `/companies` returns the same shape with `signal` possibly null.
 */

export type OrgKind = "business" | "gov" | "nonprofit" | "unknown" | string;
export type HqScope = "local" | "state" | "national" | "unknown" | string;
export type EntityFlag =
  "local" | "state" | "nationwide" | "gov" | "non-profit" | "unknown" | string;
export type ConfidenceLevel = "high" | "medium" | "low" | string;

export type SignalRow = components["schemas"]["CompanyMention"];

export type CompanyMentionRow = SignalRow;

export interface SignalListFilters {
  id?: number | string;
  industry?: string;
  revenue_bin?: string;
  q?: string;
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
export type CrossJobSignalRow = components["schemas"]["GlobalSignalRow"];
