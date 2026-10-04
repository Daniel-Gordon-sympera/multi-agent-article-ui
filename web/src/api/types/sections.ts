/** `sections.site_sections` rows of `GET /v1/jobs/{id}/sections`. */
import type { IsoDateTime, Uuid } from "./common";

export interface SectionRow {
  id: number;
  site_run_id: Uuid;
  exploration_id?: Uuid | null;
  /** The 1..n id of a kept section; null for skipped rows. */
  section_id: number | null;
  domain?: string;
  url: string;
  canonical_url?: string;
  title: string;
  kind?: string;
  kept: boolean;
  reason: string;
  origin: "agent" | "memory" | string;
  recorded_at: IsoDateTime;
  [extra: string]: unknown;
}

export interface SectionListFilters {
  kept?: boolean | "true" | "false";
  origin?: string;
}
