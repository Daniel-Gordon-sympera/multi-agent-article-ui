/**
 * Work items drawer — the discovery work of one site run (`GET /v1/site-runs/{id}/work`) with
 * stage / outcome filters and keyset paging. URL-bound through `?work=<siteRunId>`.
 */
import type { ColumnDef } from "@tanstack/react-table";
import { useMemo, useState } from "react";
import { qk } from "@/api/keys";
import { useKeysetPage } from "@/api/pagination";
import { listSiteRunWork } from "@/api/pipeline";
import type { SiteRun, WorkItem } from "@/api/types/siteRuns";
import { DataTable } from "@/components/DataTable";
import { Drawer, useDrawerSearchState } from "@/components/Drawer";
import { FilterBar } from "@/components/FilterBar";
import { FilterSelect, toOptions } from "@/components/FilterSelect";
import { RelativeTime } from "@/components/RelativeTime";
import { StatusPill } from "@/components/StatusPill";
import { Tag } from "@/components/Tag";
import { formatInteger } from "@/lib/format";
import type { StatusDescriptor } from "@/lib/status";

const STAGES = ["listing", "candidate", "supplement"];
const OUTCOMES = ["completed", "rejected", "failed", "skipped", "pending"];

function workOutcomeDescriptor(outcome: string): StatusDescriptor {
  switch (outcome) {
    case "completed":
    case "accepted":
      return { tone: "done", label: outcome, indicator: "dot" };
    case "failed":
      return { tone: "fail", label: outcome, indicator: "dot" };
    case "rejected":
    case "skipped":
      return { tone: "neutral", label: outcome, indicator: "dot" };
    case "pending":
    case "running":
      return { tone: "running", label: outcome, indicator: "dot" };
    default:
      return { tone: "neutral", label: outcome || "—", indicator: "none" };
  }
}

function candidateUrl(item: WorkItem): string {
  const url = item.candidate?.url;
  return typeof url === "string" ? url : item.work_key;
}

function resultSummary(item: WorkItem): string {
  const rows = item.result?.rows;
  if (rows && typeof rows === "object") {
    const r = rows as Record<string, unknown>;
    const parts = ["pages", "links", "articles"]
      .filter((key) => typeof r[key] === "number")
      .map((key) => `${formatInteger(r[key] as number)} ${key}`);
    if (parts.length) return parts.join(" · ");
  }
  const reason = item.result?.reason;
  if (typeof reason === "string") return reason;
  return item.error_category || "—";
}

const columns: ColumnDef<WorkItem, unknown>[] = [
  {
    id: "sequence",
    header: "#",
    meta: { align: "right", width: 56 },
    cell: ({ row }) => row.original.discovery_sequence,
  },
  {
    id: "stage",
    header: "Stage",
    meta: { width: 110 },
    cell: ({ row }) => <Tag mono>{row.original.stage}</Tag>,
  },
  {
    id: "candidate",
    header: "Candidate",
    meta: { minWidth: 200, maxWidth: 260 },
    cell: ({ row }) => {
      const url = candidateUrl(row.original);
      return (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          title={url}
          className="block truncate text-[12px] text-brand-600 hover:underline"
        >
          {url.replace(/^https?:\/\//, "")}
        </a>
      );
    },
  },
  {
    id: "outcome",
    header: "Outcome",
    meta: { width: 120 },
    cell: ({ row }) => (
      <StatusPill descriptor={workOutcomeDescriptor(row.original.outcome)} size="sm" />
    ),
  },
  {
    id: "attempts",
    header: "Attempts",
    meta: { align: "right", width: 80 },
    cell: ({ row }) => row.original.attempts,
  },
  {
    id: "result",
    header: "Result",
    meta: { minWidth: 150 },
    cell: ({ row }) => (
      <span className="text-[12px] text-ink-2">{resultSummary(row.original)}</span>
    ),
  },
  {
    id: "updated",
    header: "Updated",
    meta: { width: 110 },
    cell: ({ row }) => <RelativeTime value={row.original.updated_at} mode="clock" />,
  },
];

export function WorkItemsDrawer({ siteRuns }: { siteRuns: readonly SiteRun[] }) {
  const { value: siteRunId } = useDrawerSearchState("work");
  const run = useMemo(
    () => siteRuns.find((r) => r.id === siteRunId) ?? null,
    [siteRunId, siteRuns],
  );
  const [stage, setStage] = useState<string | undefined>();
  const [outcome, setOutcome] = useState<string | undefined>();
  const filters = { stage, outcome };
  const page = useKeysetPage<WorkItem>(
    qk.v1.siteRuns.work(siteRunId ?? "", filters),
    (params) => listSiteRunWork(siteRunId ?? "", filters, params),
    { enabled: Boolean(siteRunId), limit: 50, polling: "calm" },
  );

  return (
    <Drawer
      searchKey="work"
      width={760}
      title={run ? `Work items · ${run.domain}` : "Work items"}
      ariaLabel="Work items"
      subtitle={
        run ? (
          <span className="text-[13px] text-muted">
            {run.seed_url} · {formatInteger(run.stats.pages ?? 0)} pages ·{" "}
            {formatInteger(run.stats.articles ?? 0)} articles
          </span>
        ) : undefined
      }
    >
      <FilterBar label="Work item filters">
        <FilterSelect
          label="Stage"
          value={stage}
          onValueChange={setStage}
          options={toOptions(STAGES)}
        />
        <FilterSelect
          label="Outcome"
          value={outcome}
          onValueChange={setOutcome}
          options={toOptions(OUTCOMES)}
        />
      </FilterBar>
      <DataTable
        ariaLabel="Work items"
        columns={columns}
        data={page.items}
        getRowId={(item) => item.work_key}
        rowHeight={44}
        density="compact"
        isLoading={page.query.isPending && Boolean(siteRunId)}
        error={page.query.isError ? page.query.error : undefined}
        onRetry={() => void page.query.refetch()}
        emptyTitle="No work items match"
        emptyDescription="The discovery stage records one work item per listing page and candidate article."
        pagination={{ ...page.footer, noun: "work item" }}
      />
    </Drawer>
  );
}
