/**
 * CSV shape of a signal row — the pipeline's `signals.csv` columns (contract §1) plus the job
 * columns the BFF appends (`job_id, county, state, job_industry`, contract §4.3). Used by the
 * drawer's "Export row" and mirrored by the mock `/app/signals/export.csv`.
 */
import type { CrossJobSignalFilters } from "@/api/types/bff";
import type { CrossJobSignalRow, SignalRow } from "@/api/types/signals";
import { rowsToCsv, type CsvColumn } from "@/lib/csv";

export const SIGNAL_CSV_COLUMNS = [
  "id",
  "summary_id",
  "article_id",
  "company_id",
  "number_company",
  "name_as_written",
  "entity_type",
  "role",
  "quote_id",
  "evidence",
  "confidence_score",
  "confidence_level",
  "checks",
  "signal",
  "signal_title",
  "materiality",
  "connection",
  "signal_quote_id",
  "signal_evidence",
  "url",
  "title",
  "date",
  "source_domain",
  "article_key",
  "company_key",
  "company",
  "confidence",
  "fetch_status",
  "org_kind",
  "org_kind_basis",
  "hq_scope",
  "entity_flag",
  "hq_county",
  "hq_state",
  "scope_place",
  "scope_basis",
  "company_industry",
  "company_sub_industry",
  "industry_basis",
  "revenue_bin",
  "revenue_basis",
  "revenue_confidence",
  "enrichment_source",
] as const satisfies readonly (keyof SignalRow)[];

export const JOB_CSV_COLUMNS = ["job_id", "county", "state", "job_industry"] as const;

export type SignalExportRow = SignalRow & Partial<Omit<CrossJobSignalRow, keyof SignalRow>>;

/** The export columns in order; `state` reads the job's `state_code`. */
export const SIGNAL_EXPORT_COLUMNS: readonly CsvColumn<SignalExportRow>[] = [
  ...SIGNAL_CSV_COLUMNS.map((column) => ({
    header: column,
    value: (row: SignalExportRow) => row[column],
  })),
  { header: "job_id", value: (row) => row.job_id ?? "" },
  { header: "county", value: (row) => row.county ?? "" },
  { header: "state", value: (row) => row.state_code ?? "" },
  { header: "job_industry", value: (row) => row.job_industry ?? "" },
];

export function signalRowsToCsv(rows: readonly SignalExportRow[]): string {
  return rowsToCsv(rows, SIGNAL_EXPORT_COLUMNS);
}

/** `signal-48902.csv` — the file name of a one-row export. */
export function signalRowFilename(row: Pick<SignalRow, "id">): string {
  return `signal-${row.id}.csv`;
}

/** Keeps only the §4.4 filters of a search object (drops view/detail/table state). */
export function toCrossJobFilters(search: Record<string, unknown>): CrossJobSignalFilters {
  const keys: (keyof CrossJobSignalFilters)[] = [
    "signal",
    "materiality",
    "company_key",
    "hq_scope",
    "org_kind",
    "industry",
    "job_industry",
    "state",
    "county",
    "revenue_bin",
    "date_after",
    "date_before",
    "job_id",
    "batch_id",
    "q",
  ];
  const filters: CrossJobSignalFilters = {};
  for (const key of keys) {
    const value = search[key];
    if (typeof value === "string" && value.trim()) filters[key] = value.trim();
  }
  return filters;
}
