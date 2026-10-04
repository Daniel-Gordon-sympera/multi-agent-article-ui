/**
 * Import CSV dialog (mockup §3.10 header action): a file input for `name,url,county,state,
 * industries` (industries `;`-separated, ≤ 1 MB / 2,000 rows), a template link (CSV data URL)
 * and, after the upload, the result summary with the skipped rows and their reasons.
 */
import { Download, Upload } from "lucide-react";
import { useId, useState } from "react";
import type { SourceImportResult } from "@/api/types/bff";
import { Button } from "@/components/Button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { formatBytes } from "@/lib/format";
import { CSV_TEMPLATE_HREF, MAX_IMPORT_BYTES } from "./sourcePresentation";
import { useSourceMutations } from "./useSourceMutations";

export interface ImportCsvDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ImportCsvDialog({ open, onOpenChange }: ImportCsvDialogProps) {
  const { importCsv } = useSourceMutations();
  const [file, setFile] = useState<File | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [result, setResult] = useState<SourceImportResult | null>(null);
  const inputId = useId();

  const choose = (next: File | null) => {
    setResult(null);
    setFile(next);
    if (next && next.size > MAX_IMPORT_BYTES) {
      setProblem(`The file is ${formatBytes(next.size)}; the limit is 1 MB.`);
    } else {
      setProblem(null);
    }
  };

  const submit = async () => {
    if (!file || problem) return;
    try {
      setResult(await importCsv.mutateAsync(file));
    } catch {
      // toasted by the mutation
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => (importCsv.isPending ? undefined : onOpenChange(next))}
    >
      <DialogContent className="max-w-[560px]">
        <DialogHeader>
          <DialogTitle>Import sources from CSV</DialogTitle>
          <DialogDescription>
            Columns <code className="font-mono text-[12px]">name,url,county,state,industries</code>{" "}
            — industries separated by <code className="font-mono text-[12px]">;</code>, state as a
            2-letter code or full name. Up to 1 MB and 2,000 rows; domains already listed for the
            same county are skipped.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={inputId}>CSV file</Label>
            <input
              id={inputId}
              type="file"
              accept=".csv,text/csv"
              aria-describedby={problem ? `${inputId}-error` : undefined}
              onChange={(event) => choose(event.target.files?.[0] ?? null)}
              className="block w-full rounded-control border border-border-strong bg-surface text-[13px] text-ink file:mr-3 file:h-10 file:border-0 file:border-r file:border-border-strong file:bg-surface-2 file:px-3 file:text-[13px] file:font-semibold file:text-ink-2"
            />
            {problem ? (
              <p id={`${inputId}-error`} role="alert" className="text-[12px] text-status-fail-fg">
                {problem}
              </p>
            ) : null}
          </div>
          <a
            href={CSV_TEMPLATE_HREF}
            download="sources-template.csv"
            className="inline-flex items-center gap-1.5 text-[13px] font-medium text-brand-600 hover:underline"
          >
            <Download size={14} aria-hidden />
            Download the CSV template
          </a>
          {result ? <ImportSummary result={result} /> : null}
        </div>
        <DialogFooter>
          <Button
            variant="secondary"
            onClick={() => onOpenChange(false)}
            disabled={importCsv.isPending}
          >
            {result ? "Done" : "Cancel"}
          </Button>
          {result ? null : (
            <Button
              variant="primary"
              onClick={() => void submit()}
              disabled={!file || !!problem}
              loading={importCsv.isPending}
            >
              <Upload aria-hidden />
              Import
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ImportSummary({ result }: { result: SourceImportResult }) {
  const importedWord = result.imported === 1 ? "source" : "sources";
  return (
    <div
      role="status"
      className="flex flex-col gap-2 rounded-banner border border-border bg-surface-2 px-3.5 py-3 text-[13px]"
    >
      <p className="font-semibold text-ink">
        Imported {result.imported} {importedWord}
        {result.skipped.length ? `, skipped ${result.skipped.length}` : ""}.
      </p>
      {result.skipped.length ? (
        <ul className="flex max-h-48 flex-col gap-1 overflow-y-auto text-[12px] text-ink-2">
          {result.skipped.map((entry) => (
            <li key={`${entry.row}-${entry.reason}`}>
              <span className="font-mono text-muted">row {entry.row}</span> · {entry.reason}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
