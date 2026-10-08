import type { components } from "../pipeline.gen";
import type { CrossJobSignalRow } from "./signals";

export interface CrossJobSignalFilters {
  signal?: string;
  materiality?: string;
  company_key?: string;
  hq_scope?: string;
  org_kind?: string;
  industry?: string;
  job_industry?: string;
  state?: string;
  county?: string;
  revenue_bin?: string;
  date_after?: string;
  date_before?: string;
  job_id?: string;
  batch_id?: string;
  q?: string;
}

export interface CrossJobSignalsPage {
  items: CrossJobSignalRow[];
  next_cursor: string | null;
}

/** Exact summary of all matching per-job signal rows. */
export type CrossJobSignalsSummary = components["schemas"]["SignalSummary"];
