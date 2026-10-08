import type { components } from "../pipeline.gen";
/** `discovery.articles` ⋈ `discovery.job_articles` rows of `GET /v1/jobs/{id}/articles`. */

export type ArticleRow = components["schemas"]["ArticleRow"];

export interface ArticleListFilters {
  domain?: string;
  origin?: string;
  created_after?: string;
}

/** `GET /v1/articles/{id}` (without `include=text`). */
export type ArticleDetail = components["schemas"]["ArticleRow"];
