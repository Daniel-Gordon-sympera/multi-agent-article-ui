/** Column definitions of the Data Sources table — exactly mockup §3.10 (7 columns, rows 64). */
import { Link } from "@tanstack/react-router";
import type { ColumnDef } from "@tanstack/react-table";
import type { Source } from "@/api/types/bff";
import { Meter } from "@/components/Meter";
import { StatusPill } from "@/components/StatusPill";
import { Tag } from "@/components/Tag";
import { shortId } from "@/lib/format";
import { isExternalUrl } from "@/lib/url";
import { SourceRowActions } from "./SourceRowActions";
import {
  countyLabel,
  originLine,
  precisionCounts,
  precisionPercent,
  relativeDayLabel,
} from "./sourcePresentation";

export const PRECISION_NOTE = "No complete candidate measurements";

export interface SourceColumnsOptions {
  canOperate: boolean;
  onEdit: (source: Source) => void;
}

export function sourceColumns({
  canOperate,
  onEdit,
}: SourceColumnsOptions): ColumnDef<Source, unknown>[] {
  const columns: ColumnDef<Source, unknown>[] = [
    {
      id: "source",
      header: "Source",
      meta: { hideable: false, minWidth: 200 },
      cell: ({ row }) => (
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="truncate font-semibold text-ink">{row.original.name}</span>
          <a
            href={row.original.url}
            target={isExternalUrl(row.original.url) ? "_blank" : undefined}
            rel="noreferrer noopener"
            className="truncate text-[12px] text-brand-600 hover:underline"
          >
            {row.original.domain}
          </a>
        </div>
      ),
    },
    {
      id: "location",
      header: "Location",
      meta: { minWidth: 130 },
      cell: ({ row }) => (
        <div className="flex flex-col gap-0.5">
          <span>{countyLabel(row.original.county)}</span>
          <span className="text-[12px] text-muted">{row.original.state_code}</span>
        </div>
      ),
    },
    {
      id: "industries",
      header: "Industries",
      meta: { minWidth: 160 },
      cell: ({ row }) =>
        row.original.industries.length ? (
          <div className="flex flex-wrap gap-1.5">
            {row.original.industries.map((industry) => (
              <Tag key={industry}>{industry}</Tag>
            ))}
          </div>
        ) : (
          <span className="text-muted">all industries</span>
        ),
    },
    {
      id: "origin",
      header: "Origin",
      meta: { minWidth: 180 },
      cell: ({ row }) => (
        <div className="flex flex-col items-start gap-1">
          <Tag tone={row.original.origin === "finder" ? "brand" : "neutral"}>
            {row.original.origin}
          </Tag>
          <span className="text-[12px] whitespace-nowrap text-muted">
            {originLine(row.original)}
          </span>
        </div>
      ),
    },
    {
      id: "precision",
      header: "Article acceptance rate",
      meta: { minWidth: 190, label: "Article acceptance rate" },
      cell: ({ row }) => {
        const precision = row.original.precision;
        if (!precision) {
          return (
            <div className="flex flex-col gap-0.5">
              <span className="text-muted">—</span>
              <span className="text-[11px] text-muted">{PRECISION_NOTE}</span>
            </div>
          );
        }
        return (
          <div className="flex flex-col gap-1">
            {precision.ratio === null ? (
              <span className="text-muted">
                {!precision.complete
                  ? "Unavailable: incomplete candidate history"
                  : precision.candidates === 0
                    ? "Unavailable: no candidates recorded"
                    : "Unavailable"}
              </span>
            ) : (
              <Meter
                value={precision.ratio ?? 0}
                width={72}
                label={precisionPercent(precision)}
                ariaLabel={`Article acceptance rate of ${row.original.name}`}
              />
            )}
            <span className="text-[12px] text-muted tabular">{precisionCounts(precision)}</span>
            {precision.job_id ? (
              <span className="text-[12px] text-muted">
                <Link
                  to="/jobs/$jobId"
                  params={{ jobId: precision.job_id }}
                  className="font-mono text-brand-600 hover:underline"
                >
                  {shortId(precision.job_id)}
                </Link>{" "}
                · {relativeDayLabel(precision.at)}
              </span>
            ) : null}
          </div>
        );
      },
    },
    {
      id: "status",
      header: "Status",
      meta: { width: 110 },
      cell: ({ row }) => <StatusPill entity="source" status={row.original.status} size="sm" />,
    },
  ];
  if (canOperate) {
    columns.push({
      id: "actions",
      header: "Actions",
      meta: { actions: true, align: "right", hideable: false, interactive: true, width: 140 },
      cell: ({ row }) => <SourceRowActions source={row.original} onEdit={onEdit} />,
    });
  }
  return columns;
}
