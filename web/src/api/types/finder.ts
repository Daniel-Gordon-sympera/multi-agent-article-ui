import type { components } from "../pipeline.gen";
/** Finder rows: `GET /v1/jobs/{id}/sources`, `/ranking` and `GET /v1/finder/memory`. */

export type FinderVerdict = "accept" | "reject" | string;
export type FinderTier = "high" | "medium" | "low" | "unlabelled" | string;

/** `finder.sources` + `created_at`. */
export type FinderSourceRow = components["schemas"]["SourceRow"];

export interface FinderSourceFilters {
  verdict?: string;
  origin?: string;
}

/** `finder.rankings` row. */
export type RankingRow = components["schemas"]["RankingRow"];

export interface RankingFilters {
  tier?: string;
  chosen?: boolean | "true" | "false";
}

/** `finder.judged_domains` row (the cross-job warm memory). */
export type FinderMemoryRow = components["schemas"]["FinderMemoryRow"];

export interface FinderMemoryFilters {
  location?: string;
  industry?: string;
  domain?: string;
  verdict?: string;
  created_after?: string;
}
