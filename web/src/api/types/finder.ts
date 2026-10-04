/** Finder rows: `GET /v1/jobs/{id}/sources`, `/ranking` and `GET /v1/finder/memory`. */
import type { IsoDateTime, Uuid } from "./common";

export type FinderVerdict = "accept" | "reject" | string;
export type FinderTier = "high" | "medium" | "low" | "unlabelled" | string;

/** `finder.sources` + `created_at`. */
export interface FinderSourceRow {
  search_id: Uuid;
  domain: string;
  name: string;
  url: string;
  coverage: string;
  relevance: string;
  reason: string;
  verdict: FinderVerdict;
  origin: "judge" | "memory" | string;
  round: number | null;
  source_order: number | null;
  created_at: IsoDateTime;
}

export interface FinderSourceFilters {
  verdict?: string;
  origin?: string;
}

/** `finder.rankings` row. */
export interface RankingRow {
  search_id: Uuid;
  tier: FinderTier;
  tier_rank: number;
  overall_rank: number;
  url: string;
  name: string;
  reason: string;
  pages_opened: number;
  coverage: string | null;
  relevance: string | null;
  finder_reason: string | null;
  chosen: boolean;
}

export interface RankingFilters {
  tier?: string;
  chosen?: boolean | "true" | "false";
}

/** `finder.judged_domains` row (the cross-job warm memory). */
export interface FinderMemoryRow {
  location_key: string;
  industry_key: string;
  domain: string;
  verdict: FinderVerdict;
  name: string | null;
  url: string | null;
  coverage: string | null;
  relevance: string | null;
  reason: string | null;
  tier?: FinderTier | null;
  judged_at: IsoDateTime;
  search_id: Uuid;
  job_id?: Uuid | null;
  source_order: number | null;
}

export interface FinderMemoryFilters {
  location?: string;
  industry?: string;
  domain?: string;
  verdict?: string;
  created_after?: string;
}
