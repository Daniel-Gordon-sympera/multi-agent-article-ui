/**
 * This browser's dataset exports: each row polls `GET /v1/exports/{id}` every 5 s while queued or
 * running, then shows the Download link (`download_url` through the `/v1` proxy) or "expired".
 */
import { useQuery } from "@tanstack/react-query";
import { Download, X } from "lucide-react";
import { qk } from "@/api/keys";
import { getExport } from "@/api/pipeline";
import { Button } from "@/components/Button";
import { EmptyState } from "@/components/EmptyState";
import { RelativeTime } from "@/components/RelativeTime";
import { StatusPill } from "@/components/StatusPill";
import { errorMessage } from "@/lib/errors";
import { ACTIVE_EXPORT_STATUSES, EXPORT_POLL_MS, exportStatus } from "./exportsFormat";
import type { LocalExportRecord } from "./localExports";

function ExportRow({
  local,
  onForget,
}: {
  local: LocalExportRecord;
  onForget: (id: string) => void;
}) {
  const query = useQuery({
    queryKey: qk.v1.exports.detail(local.id),
    queryFn: () => getExport(local.id),
    refetchInterval: (q) =>
      ACTIVE_EXPORT_STATUSES.has(q.state.data?.status ?? "queued") ? EXPORT_POLL_MS : false,
    refetchIntervalInBackground: false,
    staleTime: EXPORT_POLL_MS,
    retry: false,
  });
  const record = query.data;
  const descriptor = exportStatus(record, query.error);
  return (
    <tr className="data-table-row">
      <td className="border-b border-border py-[var(--cell-py)] pl-5 pr-3 align-middle">
        <span className="font-mono text-[12px] text-ink">{local.id}</span>
      </td>
      <td className="border-b border-border px-3 py-[var(--cell-py)] align-middle text-[13px] text-ink-2">
        {(record?.tables ?? local.tables).join(", ")}
      </td>
      <td className="border-b border-border px-3 py-[var(--cell-py)] align-middle">
        <RelativeTime value={record?.created_at ?? local.created_at} mode="smart" />
      </td>
      <td className="border-b border-border px-3 py-[var(--cell-py)] align-middle">
        <StatusPill descriptor={descriptor} size="sm" />
        {query.error ? (
          <span className="mt-1 block text-[11px] text-muted">{errorMessage(query.error)}</span>
        ) : null}
      </td>
      <td
        className="border-b border-border py-[var(--cell-py)] pr-5 pl-3 text-right align-middle"
        data-interactive="true"
      >
        <span className="inline-flex items-center justify-end gap-1.5">
          {record?.download_url && !record.download_expired ? (
            <Button asChild variant="secondary" size="xs">
              <a href={record.download_url} download>
                <Download aria-hidden />
                Download
              </a>
            </Button>
          ) : record?.download_expired ? (
            <span className="text-[12px] text-muted">expired</span>
          ) : null}
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label={`Forget export ${local.id}`}
            onClick={() => onForget(local.id)}
          >
            <X aria-hidden />
          </Button>
        </span>
      </td>
    </tr>
  );
}

export interface ExportsTableProps {
  exports: LocalExportRecord[];
  onForget: (id: string) => void;
}

export function ExportsTable({ exports, onForget }: ExportsTableProps) {
  return (
    <div className="data-table card overflow-hidden p-0">
      <div className="overflow-x-auto">
        <table
          aria-label="Exports started from this browser"
          className="w-full border-separate border-spacing-0 text-[13px] text-ink"
          style={{ minWidth: 720 }}
        >
          <thead>
            <tr>
              {["Export", "Tables", "Created", "Status"].map((header) => (
                <th
                  key={header}
                  scope="col"
                  className="h-10 border-b border-border bg-surface-2 px-3 text-left text-table-head whitespace-nowrap text-muted first:pl-5"
                >
                  {header}
                </th>
              ))}
              <th
                scope="col"
                className="h-10 border-b border-border bg-surface-2 pr-5 pl-3 text-right text-table-head text-muted"
              >
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {exports.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-0">
                  <EmptyState
                    variant="plain"
                    title="No exports started from this browser"
                    description="Start a dataset export above; it appears here and refreshes until the file is ready."
                  />
                </td>
              </tr>
            ) : (
              exports.map((local) => <ExportRow key={local.id} local={local} onForget={onForget} />)
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
