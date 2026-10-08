import type { components } from "../pipeline.gen";
/** `analysis.summaries` rows of `GET /v1/jobs/{id}/summaries` (+ article columns). */

export type SummaryRow = components["schemas"]["SummaryRow"];

export interface SummaryListFilters {
  industry?: string;
  materiality?: string;
  signal?: string;
  include?: "record";
}
