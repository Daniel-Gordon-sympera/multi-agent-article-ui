/** `analysis.summaries` rows of `GET /v1/jobs/{id}/summaries` (+ article columns). */
import type { IsoDate, IsoDateTime, JsonObject, Uuid } from "./common";

export interface SummaryRow {
  id: number;
  article_id: number;
  prompt_version: string;
  model: string;
  first_job_id: Uuid;
  task_id: number;
  main_idea: string | null;
  short_snippet: string | null;
  narrative?: string | null;
  focus_topics: string[];
  content_type?: string | null;
  industry: string | null;
  sub_industry: string | null;
  article_signal: string | null;
  article_materiality: string | null;
  companies: number | string[] | null;
  company_mentions: number | null;
  sponsored: boolean;
  is_list_page: boolean;
  kept_count?: number;
  warnings: string[];
  failure?: string | null;
  input_tokens: number | null;
  output_tokens: number | null;
  created_at: IsoDateTime;
  // article
  url: string;
  title: string;
  date: IsoDate;
  source_domain: string;
  article_key: string;
  /** Only with `?include=record`. */
  record?: JsonObject;
  [extra: string]: unknown;
}

export interface SummaryListFilters {
  industry?: string;
  materiality?: string;
  signal?: string;
  include?: "record";
}
