/**
 * Export CSV menu — mockup §2.3 / §6.6: one entry per per-job table (the 11 tables of
 * `GET /v1/jobs/{id}/export/{table}.csv`), each a plain download link through the BFF proxy.
 */
import { ChevronDown, Download } from "lucide-react";
import { Button, type ButtonProps } from "@/components/Button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { JOB_EXPORT_TABLES, JOB_EXPORT_TABLE_LABELS, jobExportUrl } from "@/lib/csv";
import { shortId } from "@/lib/format";

export interface ExportMenuProps {
  jobId: string;
  size?: ButtonProps["size"];
  label?: string;
}

export function ExportMenu({ jobId, size = "md", label = "Export CSV" }: ExportMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="secondary" size={size} aria-label={`${label} for job ${shortId(jobId)}`}>
          <Download aria-hidden />
          {label}
          <ChevronDown aria-hidden className="-mr-1" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>One CSV per table</DropdownMenuLabel>
        {JOB_EXPORT_TABLES.map((table) => (
          <DropdownMenuItem key={table} asChild>
            <a
              href={jobExportUrl(jobId, table)}
              download={`${shortId(jobId)}-${table}.csv`}
              className="text-ink no-underline hover:no-underline"
            >
              {JOB_EXPORT_TABLE_LABELS[table]}
              <span className="ml-auto font-mono text-[11px] text-muted">{table}.csv</span>
            </a>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
