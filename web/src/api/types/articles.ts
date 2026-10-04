/** `discovery.articles` ⋈ `discovery.job_articles` rows of `GET /v1/jobs/{id}/articles`. */
import type { IsoDate, IsoDateTime, Uuid } from "./common";

export interface ArticleRow {
  id: number;
  url_id?: number;
  canonical_url: string;
  domain: string;
  title: string;
  published_date: IsoDate;
  first_job_id?: Uuid;
  first_site_run_id?: Uuid;
  snapshot_id: number | null;
  text_sha: string | null;
  html_sha: string | null;
  first_seen: IsoDateTime;
  created_at?: IsoDateTime;
  updated_at?: IsoDateTime;
  // job membership
  site_run_id: Uuid;
  article_key: string;
  link_key: string;
  origin: "fetched" | "memory" | string;
  accepted_at: IsoDateTime;
  [extra: string]: unknown;
}

export interface ArticleListFilters {
  domain?: string;
  origin?: string;
  created_after?: string;
}

/** `GET /v1/articles/{id}` (without `include=text`). */
export interface ArticleDetail extends Omit<
  ArticleRow,
  "site_run_id" | "article_key" | "link_key" | "origin" | "accepted_at"
> {
  text_url?: string | null;
  text_expired?: boolean;
}
