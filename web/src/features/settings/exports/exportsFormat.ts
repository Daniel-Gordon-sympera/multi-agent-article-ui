/** Pure helpers of Settings › Exports: the API `filters` object and the status pill mapping. */
import type { ExportRecord } from "@/api/types/stats";
import type { StatusDescriptor } from "@/lib/status";

export const EXPORT_POLL_MS = 5_000;
export const ACTIVE_EXPORT_STATUSES = new Set(["queued", "running"]);

export interface ExportFormInput {
  state: string;
  county: string;
  statuses: string[];
  createdAfter: string;
  createdBefore: string;
}

/** Builds the `filters` object `POST /v1/exports` receives; empty values are dropped. */
export function buildExportFilters(input: ExportFormInput): Record<string, unknown> {
  const filters: Record<string, unknown> = {};
  if (input.state.trim()) filters.state = input.state.trim().toUpperCase();
  if (input.county.trim()) filters.county = input.county.trim();
  if (input.statuses.length) filters.statuses = [...input.statuses];
  if (input.createdAfter) filters.created_after = input.createdAfter;
  if (input.createdBefore) filters.created_before = input.createdBefore;
  return filters;
}

export function exportStatus(record: ExportRecord | undefined, error: unknown): StatusDescriptor {
  if (error) return { tone: "fail", label: "Unavailable", indicator: "dot" };
  if (!record) return { tone: "neutral", label: "Checking", indicator: "dot" };
  if (record.download_expired) return { tone: "neutral", label: "Expired", indicator: "dot" };
  switch (record.status) {
    case "queued":
      return { tone: "neutral", label: "Queued", indicator: "dot" };
    case "running":
      return { tone: "running", label: "Running", indicator: "dot" };
    case "completed":
    case "succeeded":
      return { tone: "done", label: "Ready", indicator: "dot" };
    case "failed":
    case "dead":
      return { tone: "fail", label: "Failed", indicator: "dot" };
    default:
      return { tone: "neutral", label: record.status, indicator: "dot" };
  }
}
