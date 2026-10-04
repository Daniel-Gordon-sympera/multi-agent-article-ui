/**
 * `[⤓ Export CSV]` — a plain download link to `GET /v1/jobs/{id}/export/{table}.csv` styled as
 * the mockup's sm secondary button (mockup §3.6 / §6.6: one label, the filename in the tooltip).
 */
import { Download } from "lucide-react";
import { Button, type ButtonProps } from "@/components/Button";
import { SimpleTooltip } from "@/components/ui/tooltip";
import { jobExportUrl, type JobExportTable } from "@/lib/csv";
import { shortId } from "@/lib/format";

export interface CsvExportButtonProps {
  jobId: string;
  table: JobExportTable;
  size?: ButtonProps["size"];
  label?: string;
}

export function CsvExportButton({
  jobId,
  table,
  size = "sm",
  label = "Export CSV",
}: CsvExportButtonProps) {
  return (
    <SimpleTooltip content={`${table}.csv — every row of this job`}>
      <Button asChild variant="secondary" size={size}>
        <a
          href={jobExportUrl(jobId, table)}
          download={`${shortId(jobId)}-${table}.csv`}
          aria-label={`${label} (${table}.csv)`}
          className="text-ink no-underline hover:no-underline"
        >
          <Download aria-hidden />
          {label}
        </a>
      </Button>
    </SimpleTooltip>
  );
}
