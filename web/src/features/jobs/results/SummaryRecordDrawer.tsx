/**
 * Summary record drawer (`?record=<summary id>`): the full summary row (article, analysis,
 * model facts, warnings) and, on demand, the raw `record` JSON from
 * `GET /v1/articles/{id}/summaries?include=record`.
 */
import { useQuery } from "@tanstack/react-query";
import { ExternalLink, FileJson } from "lucide-react";
import { useMemo, useState } from "react";
import { qk } from "@/api/keys";
import { listArticleSummaries } from "@/api/pipeline";
import { pollingOptions } from "@/api/polling";
import type { SummaryRow } from "@/api/types/summaries";
import { Button } from "@/components/Button";
import { Drawer, DrawerSection, useDrawerSearchState } from "@/components/Drawer";
import { ErrorState } from "@/components/ErrorState";
import { KeyValueGrid } from "@/components/KeyValueGrid";
import { MaterialityPill } from "@/components/MaterialityPill";
import { SkeletonLines } from "@/components/Skeleton";
import { Tag } from "@/components/Tag";
import { formatCompactNumber, formatDate } from "@/lib/format";
import { companiesCount } from "./summariesColumns";

function RawRecord({ summary }: { summary: SummaryRow }) {
  const [wanted, setWanted] = useState(false);
  const record = useQuery({
    queryKey: qk.v1.articles.summaries(summary.article_id, {
      include: "record",
      summary: summary.id,
    }),
    queryFn: async () => {
      const page = await listArticleSummaries(summary.article_id, { include: "record" });
      return page.items.find((row) => row.id === summary.id)?.record ?? null;
    },
    enabled: wanted,
    ...pollingOptions("static"),
  });
  if (!wanted) {
    return (
      <Button variant="secondary" size="sm" onClick={() => setWanted(true)}>
        <FileJson aria-hidden />
        Load the raw record
      </Button>
    );
  }
  if (record.isPending) return <SkeletonLines lines={4} />;
  if (record.isError) return <ErrorState variant="plain" error={record.error} />;
  if (!record.data) {
    return <p className="text-[13px] text-muted">The API returned no record for this summary.</p>;
  }
  return (
    <pre className="max-h-[420px] overflow-auto rounded-control border border-border bg-surface-2 p-3 font-mono text-[11px] leading-relaxed text-ink-2">
      {JSON.stringify(record.data, null, 2)}
    </pre>
  );
}

export function SummaryRecordDrawer({ rows }: { rows: readonly SummaryRow[] }) {
  const { value } = useDrawerSearchState("record");
  const summary = useMemo(
    () => rows.find((row) => String(row.id) === value) ?? null,
    [rows, value],
  );

  return (
    <Drawer
      searchKey="record"
      width={560}
      ariaLabel="Summary record"
      title={summary?.title ?? "Summary"}
      titleAside={summary ? <Tag mono>#{summary.id}</Tag> : undefined}
      subtitle={
        summary ? (
          <span className="text-[13px] text-muted">
            {summary.source_domain} · {formatDate(summary.date)} · prompt{" "}
            <span className="font-mono">{summary.prompt_version}</span>
          </span>
        ) : undefined
      }
      footer={
        summary ? (
          <Button asChild variant="secondary" size="sm">
            <a href={summary.url} target="_blank" rel="noopener noreferrer">
              <ExternalLink aria-hidden />
              Open article
            </a>
          </Button>
        ) : undefined
      }
    >
      {!summary ? (
        <p className="text-[13px] text-muted">
          This summary is not on the loaded page — move to its page or clear the filters.
        </p>
      ) : (
        <>
          <DrawerSection title="Analysis">
            <p className="text-[14px] leading-[1.55] text-ink">{summary.main_idea ?? "—"}</p>
            {summary.short_snippet ? (
              <p className="text-[13px] text-ink-2">{summary.short_snippet}</p>
            ) : null}
            {summary.narrative ? (
              <p className="text-[13px] text-ink-2">{summary.narrative}</p>
            ) : null}
            <KeyValueGrid
              items={[
                { label: "Industry", value: summary.industry ?? "—" },
                { label: "Sub-industry", value: summary.sub_industry ?? "—" },
                { label: "Article signal", value: summary.article_signal ?? "—" },
                {
                  label: "Materiality",
                  value: <MaterialityPill materiality={summary.article_materiality} />,
                },
                { label: "Companies", value: String(companiesCount(summary) ?? "—") },
                { label: "Content type", value: summary.content_type ?? "—" },
              ]}
            />
            {summary.focus_topics?.length ? (
              <div className="flex flex-wrap gap-1">
                {summary.focus_topics.map((topic) => (
                  <Tag key={topic}>{topic}</Tag>
                ))}
              </div>
            ) : null}
          </DrawerSection>
          <DrawerSection title="Model">
            <KeyValueGrid
              items={[
                { label: "Model", value: summary.model, mono: true },
                { label: "Prompt version", value: summary.prompt_version, mono: true },
                {
                  label: "Tokens",
                  value: `${formatCompactNumber(summary.input_tokens)} in · ${formatCompactNumber(summary.output_tokens)} out`,
                },
                { label: "Task", value: `#${summary.task_id}`, mono: true },
                { label: "Sponsored", value: summary.sponsored ? "yes" : "no" },
                { label: "List page", value: summary.is_list_page ? "yes" : "no" },
              ]}
            />
            {summary.warnings?.length ? (
              <ul className="list-disc pl-5 text-[13px] text-status-warn-fg">
                {summary.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            ) : null}
          </DrawerSection>
          <DrawerSection title="Raw record">
            <RawRecord summary={summary} />
          </DrawerSection>
        </>
      )}
    </Drawer>
  );
}
