/**
 * Dataset export form → `POST /v1/exports` (`scope: "dataset"`, operator only): the 11 tables as
 * checkboxes plus optional filters (state, county, job statuses, created range).
 */
import { useMutation } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { useState } from "react";
import { createExport } from "@/api/pipeline";
import type { CreatedExport } from "@/api/types/stats";
import { Button } from "@/components/Button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/sonner";
import { JOB_EXPORT_TABLES, JOB_EXPORT_TABLE_LABELS, type JobExportTable } from "@/lib/csv";
import { toastError } from "@/lib/errors";
import { TERMINAL_JOB_STATUSES } from "@/lib/status";
import { buildExportFilters } from "./exportsFormat";

export interface DatasetExportFormProps {
  onCreated: (created: CreatedExport, tables: string[]) => void;
}

export function DatasetExportForm({ onCreated }: DatasetExportFormProps) {
  const [tables, setTables] = useState<JobExportTable[]>(["signals", "companies"]);
  const [state, setState] = useState("");
  const [county, setCounty] = useState("");
  const [statuses, setStatuses] = useState<string[]>([]);
  const [createdAfter, setCreatedAfter] = useState("");
  const [createdBefore, setCreatedBefore] = useState("");

  const create = useMutation({
    mutationFn: () =>
      createExport({
        scope: "dataset",
        tables,
        kind: "csv",
        filters: buildExportFilters({ state, county, statuses, createdAfter, createdBefore }),
      }),
    onSuccess: (created) => {
      onCreated(created, tables);
      toast.success("Export queued", {
        description: `${tables.length} tables · id ${created.export_id}`,
      });
    },
    onError: (error) => toastError(error, "The export was not started"),
  });

  const toggle = <T extends string>(list: T[], value: T, set: (next: T[]) => void) =>
    set(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);

  return (
    <form
      className="card flex flex-col gap-5 p-5"
      aria-labelledby="dataset-export-title"
      onSubmit={(event) => {
        event.preventDefault();
        if (tables.length) create.mutate();
      }}
    >
      <div className="flex flex-col gap-1">
        <h3 id="dataset-export-title" className="text-card-title text-ink">
          Dataset export
        </h3>
        <p className="text-[13px] text-muted">
          One CSV per table across every job that matches the filters; built by the maintenance
          worker, downloadable below once it finishes.
        </p>
      </div>
      <fieldset className="flex flex-col gap-2">
        <legend className="text-[13px] font-semibold text-ink-2">Tables</legend>
        <div
          className="grid gap-2"
          style={{ gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))" }}
        >
          {JOB_EXPORT_TABLES.map((table) => (
            <label key={table} className="flex items-center gap-2 text-[13px] text-ink">
              <Checkbox
                checked={tables.includes(table)}
                onCheckedChange={() => toggle(tables, table, setTables)}
                aria-label={JOB_EXPORT_TABLE_LABELS[table]}
              />
              {JOB_EXPORT_TABLE_LABELS[table]}
            </label>
          ))}
        </div>
        {tables.length === 0 ? (
          <p className="text-[12px] text-status-fail-fg" role="alert">
            Pick at least one table.
          </p>
        ) : null}
      </fieldset>
      <div
        className="grid gap-4"
        style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}
      >
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="export-state">State</Label>
          <Input
            id="export-state"
            value={state}
            onChange={(e) => setState(e.target.value)}
            placeholder="FL"
            maxLength={2}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="export-county">County</Label>
          <Input
            id="export-county"
            value={county}
            onChange={(e) => setCounty(e.target.value)}
            placeholder="Orange"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="export-created-after">Created after</Label>
          <Input
            id="export-created-after"
            type="date"
            value={createdAfter}
            onChange={(e) => setCreatedAfter(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="export-created-before">Created before</Label>
          <Input
            id="export-created-before"
            type="date"
            value={createdBefore}
            onChange={(e) => setCreatedBefore(e.target.value)}
          />
        </div>
      </div>
      <fieldset className="flex flex-col gap-2">
        <legend className="text-[13px] font-semibold text-ink-2">Job statuses (empty = all)</legend>
        <div className="flex flex-wrap gap-4">
          {TERMINAL_JOB_STATUSES.map((status) => (
            <label key={status} className="flex items-center gap-2 text-[13px] text-ink">
              <Checkbox
                checked={statuses.includes(status)}
                onCheckedChange={() => toggle(statuses, status, setStatuses)}
                aria-label={`status ${status}`}
              />
              {status}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="flex justify-end">
        <Button
          type="submit"
          variant="primary"
          loading={create.isPending}
          disabled={tables.length === 0}
        >
          <Download aria-hidden />
          Start export
        </Button>
      </div>
    </form>
  );
}
