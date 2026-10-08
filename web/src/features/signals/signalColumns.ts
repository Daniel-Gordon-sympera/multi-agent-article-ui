/**
 * The one column registry of every signals table (mockup §6.2): the same eleven columns on
 * the Job › Signals tab and the explorer, with per-route default visibility. Cell renderers
 * live in `signalCells.tsx`; this file is pure data so tests and the column chooser agree.
 */
import type { CrossJobSignalRow, SignalRow } from "@/api/types/signals";

export const SIGNAL_COLUMN_IDS = [
  "record",
  "hqCity",
  "hqScope",
  "hqState",
  "industry",
  "revenueBin",
  "date",
  "source",
  "jobLocation",
  "job",
  "open",
] as const;

export type SignalColumnId = (typeof SIGNAL_COLUMN_IDS)[number];

/** Where the table renders: the per-job tab or the cross-job explorer. */
export type SignalsTableRoute = "job" | "explorer";

/** A row of either list; the job columns exist only on explorer rows. */
export type SignalTableRow = SignalRow &
  Partial<Pick<CrossJobSignalRow, "county" | "job_industry">>;

export interface SignalColumnSpec {
  id: SignalColumnId;
  /** Header text; the job tab's HQ city column also carries the scope chip. */
  label: Record<SignalsTableRoute, string>;
  /** Visible by default on these routes; every column stays available in the chooser. */
  defaultOn: readonly SignalsTableRoute[];
  hideable: boolean;
  align?: "left" | "right";
  width?: number;
  minWidth?: number;
  maxWidth?: number;
}

export const SIGNAL_COLUMNS: readonly SignalColumnSpec[] = [
  {
    id: "record",
    label: { job: "Signal", explorer: "Signal" },
    defaultOn: ["job", "explorer"],
    hideable: false,
    minWidth: 280,
  },
  {
    id: "hqCity",
    label: { job: "HQ city · scope", explorer: "HQ city" },
    defaultOn: ["job", "explorer"],
    hideable: true,
    minWidth: 110,
  },
  {
    id: "hqScope",
    label: { job: "HQ scope", explorer: "HQ scope" },
    defaultOn: [],
    hideable: true,
    minWidth: 90,
  },
  {
    id: "hqState",
    label: { job: "HQ state", explorer: "HQ state" },
    defaultOn: ["job", "explorer"],
    hideable: true,
    width: 84,
  },
  {
    id: "industry",
    label: { job: "Industry", explorer: "Industry" },
    defaultOn: ["job", "explorer"],
    hideable: true,
    minWidth: 130,
    maxWidth: 170,
  },
  {
    id: "revenueBin",
    label: { job: "Revenue bin", explorer: "Revenue bin" },
    defaultOn: ["job", "explorer"],
    hideable: true,
    minWidth: 100,
  },
  {
    id: "date",
    label: { job: "Date", explorer: "Date" },
    defaultOn: ["job", "explorer"],
    hideable: true,
    minWidth: 100,
  },
  {
    id: "source",
    label: { job: "Source", explorer: "Source" },
    defaultOn: ["job"],
    hideable: true,
    minWidth: 130,
    maxWidth: 170,
  },
  {
    id: "jobLocation",
    label: { job: "Job location · source", explorer: "Job location · source" },
    defaultOn: ["explorer"],
    hideable: true,
    minWidth: 140,
    maxWidth: 180,
  },
  {
    id: "job",
    label: { job: "Job", explorer: "Job" },
    defaultOn: ["explorer"],
    hideable: true,
    width: 92,
  },
  {
    id: "open",
    label: { job: "Open", explorer: "Open" },
    defaultOn: ["job", "explorer"],
    hideable: false,
    align: "right",
    width: 48,
  },
];

/** The ids visible by default on a route, in registry order. */
export function defaultVisibleColumns(route: SignalsTableRoute): SignalColumnId[] {
  return SIGNAL_COLUMNS.filter((c) => c.defaultOn.includes(route)).map((c) => c.id);
}

/** The max width of the record cell: 330 on the job tab, 280 on the explorer (mockup §3.6/§3.8). */
export const RECORD_CELL_MAX_WIDTH: Record<SignalsTableRoute, number> = {
  job: 330,
  explorer: 280,
};

export function isSignalColumnId(value: string): value is SignalColumnId {
  return (SIGNAL_COLUMN_IDS as readonly string[]).includes(value);
}

/** The evidence a row shows: the signal's own quote first, else the mention evidence. */
export function signalEvidence(row: Pick<SignalTableRow, "evidence" | "signal_evidence">): string {
  return (row.signal_evidence ?? "").trim() || row.evidence.trim();
}

export function confidenceRatio(value: number | string | null | undefined): number | null {
  const n = typeof value === "string" ? Number(value) : value;
  return n === null || n === undefined || !Number.isFinite(n) ? null : n;
}

/**
 * The `?detail=` value for a mention id. The router JSON-encodes search values, so a numeric id
 * is passed as a number (`?detail=9000`, not `?detail=%229000%22`); the schema reads it back
 * as a string.
 */
export function detailParam(id: number | string): number | string {
  if (typeof id === "number") return id;
  return /^\d+$/.test(id) ? Number(id) : id;
}

/** A mention can occur once in each job that reuses the article summary. */
export function signalRowKey(row: SignalTableRow): string {
  return `${row.job_id ?? "job"}:${row.id}`;
}
