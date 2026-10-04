/**
 * Columns of the Runs table — mockup §3.2: Job (title link / mono short id · kind · batch tag),
 * Status (pill + mono stop reason), Stages (StageBar 84), Sites "done / total", Articles,
 * Signals, Cost, Started (smart time over duration) and the row actions. The column array is
 * a module constant; the polled progress and batch facts arrive through `RunsColumnContext`.
 */
import type { ColumnDef } from "@tanstack/react-table";
import type { JobRecord } from "@/api/types/jobs";
import { RunRowActions } from "./RunRowActions";
import {
  CostCell,
  CounterCell,
  JobCell,
  SitesCell,
  StagesCell,
  StartedCell,
  StatusCell,
} from "./runsCells";

export const RUNS_COLUMNS: ColumnDef<JobRecord, unknown>[] = [
  {
    id: "job",
    header: "Job",
    meta: { hideable: false, minWidth: 260 },
    cell: ({ row }) => <JobCell job={row.original} />,
  },
  {
    id: "status",
    header: "Status",
    meta: { minWidth: 120 },
    cell: ({ row }) => <StatusCell job={row.original} />,
  },
  {
    id: "stages",
    header: "Stages",
    meta: { width: 110 },
    cell: ({ row }) => <StagesCell job={row.original} />,
  },
  {
    id: "sites",
    header: "Sites",
    meta: { align: "right", width: 90 },
    cell: ({ row }) => <SitesCell job={row.original} />,
  },
  {
    id: "articles",
    header: "Articles",
    meta: { align: "right", width: 90 },
    cell: ({ row }) => <CounterCell job={row.original} counter="articles" />,
  },
  {
    id: "signals",
    header: "Signals",
    meta: { align: "right", width: 90 },
    cell: ({ row }) => <CounterCell job={row.original} counter="signals" />,
  },
  {
    id: "cost",
    header: "Cost",
    meta: { align: "right", width: 90 },
    cell: ({ row }) => <CostCell job={row.original} />,
  },
  {
    id: "started",
    header: "Started",
    meta: { minWidth: 130, cellClassName: "text-ink-2" },
    cell: ({ row }) => <StartedCell job={row.original} />,
  },
  {
    id: "actions",
    header: "Actions",
    meta: { actions: true, align: "right", hideable: false, interactive: true },
    cell: ({ row }) => <RunRowActions job={row.original} />,
  },
];
