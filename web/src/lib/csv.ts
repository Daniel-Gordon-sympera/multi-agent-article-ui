/**
 * CSV helpers: trigger browser downloads of API-streamed CSVs (per-job exports are plain
 * links to `/v1/jobs/{id}/export/{table}.csv`) and build small client-side CSVs.
 */

/** Starts a download of `url` through a temporary anchor (same-origin; cookies travel). */
export function downloadUrl(url: string, filename?: string): void {
  const anchor = document.createElement("a");
  anchor.href = url;
  if (filename) anchor.download = filename;
  anchor.rel = "noopener";
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

/** Downloads text as a file (used for client-side CSVs). */
export function downloadText(
  filename: string,
  text: string,
  mime = "text/csv;charset=utf-8",
): void {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  try {
    downloadUrl(url, filename);
  } finally {
    // Give the click a tick before revoking the object URL.
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

export function escapeCsvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const text =
    typeof value === "object"
      ? JSON.stringify(value)
      : typeof value === "string"
        ? value
        : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export interface CsvColumn<Row> {
  header: string;
  value: (row: Row) => unknown;
}

/** Serialises rows with a header line; cells are RFC 4180-escaped. */
export function rowsToCsv<Row>(rows: readonly Row[], columns: readonly CsvColumn<Row>[]): string {
  const lines = [columns.map((c) => escapeCsvCell(c.header)).join(",")];
  for (const row of rows) {
    lines.push(columns.map((c) => escapeCsvCell(c.value(row))).join(","));
  }
  return `${lines.join("\r\n")}\r\n`;
}

/** The 11 per-job CSV tables of `GET /v1/jobs/{id}/export/{table}.csv` (contract §1). */
export const JOB_EXPORT_TABLES = [
  "sources",
  "site_ranking",
  "chosen_seeds",
  "sections",
  "pages",
  "links",
  "articles",
  "summaries",
  "companies",
  "signals",
  "company_flags",
] as const;
export type JobExportTable = (typeof JOB_EXPORT_TABLES)[number];

export const JOB_EXPORT_TABLE_LABELS: Record<JobExportTable, string> = {
  sources: "Sources",
  site_ranking: "Site ranking",
  chosen_seeds: "Chosen seeds",
  sections: "Sections",
  pages: "Pages",
  links: "Links",
  articles: "Articles",
  summaries: "Summaries",
  companies: "Companies",
  signals: "Signals",
  company_flags: "Company flags",
};

export function jobExportUrl(jobId: string, table: JobExportTable): string {
  return `/v1/jobs/${encodeURIComponent(jobId)}/export/${table}.csv`;
}
