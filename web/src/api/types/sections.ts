import type { components } from "../pipeline.gen";
/** `sections.site_sections` rows of `GET /v1/jobs/{id}/sections`. */

export type SectionRow = components["schemas"]["SectionRow"];

export interface SectionListFilters {
  kept?: boolean | "true" | "false";
  origin?: string;
}
