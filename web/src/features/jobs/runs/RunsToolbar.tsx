/**
 * Toolbar of the Runs table — mockup §3.2: search across all matching runs, selects
 * Status · State · County · Industry · Created (custom range popover with two date inputs);
 * right: density toggle, column chooser, `[⤓ Export CSV]` (the loaded page as CSV).
 */
import { CalendarRange, Download } from "lucide-react";
import { useState, type ReactNode } from "react";
import type { JobRecord } from "@/api/types/jobs";
import { Button } from "@/components/Button";
import { FilterBar } from "@/components/FilterBar";
import { FilterSelect, toOptions } from "@/components/FilterSelect";
import { SearchInput } from "@/components/SearchInput";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { jobIndustry } from "@/features/jobs/jobTitle";
import type { JobsSearch } from "@/features/jobs/searchSchemas";
import { optionsFromRows } from "@/features/jobs/shared/tableSearch";
import {
  CREATED_OPTIONS,
  DEFAULT_CREATED,
  createdLabel,
  type CreatedPreset,
} from "./createdFilter";

const STATUS_OPTIONS = [
  { value: "running", label: "Running" },
  { value: "queued", label: "Queued" },
  { value: "completed", label: "Completed" },
  { value: "partial", label: "Partial" },
  { value: "failed", label: "Failed" },
  { value: "cancelled", label: "Cancelled" },
];

export interface RunsToolbarProps {
  search: JobsSearch;
  rows: JobRecord[];
  onPatch: (patch: Partial<JobsSearch>) => void;
  tools: ReactNode;
  onExport: () => void;
  exportDisabled?: boolean;
}

export function RunsToolbar({
  search,
  rows,
  onPatch,
  tools,
  onExport,
  exportDisabled,
}: RunsToolbarProps) {
  const [rangeOpen, setRangeOpen] = useState(false);

  const states = optionsFromRows(rows, (job) => job.state_code.toUpperCase(), search.state);
  const counties = optionsFromRows(rows, (job) => job.county, search.county);
  const industries = optionsFromRows(rows, jobIndustry, search.industry);
  const created = search.created ?? DEFAULT_CREATED;

  const applyRange = (after: string, before: string) => {
    onPatch({
      created: "custom",
      created_after: after || undefined,
      created_before: before || undefined,
    });
    setRangeOpen(false);
  };

  return (
    <FilterBar
      tools={
        <>
          {tools}
          <Button variant="secondary" size="sm" onClick={onExport} disabled={exportDisabled}>
            <Download aria-hidden />
            Export CSV
          </Button>
        </>
      }
    >
      <SearchInput
        label="Search county, industry, domain, id"
        value={search.q}
        onValueChange={(q) => onPatch({ q })}
        width={230}
      />
      <FilterSelect
        label="Status"
        value={search.status}
        onValueChange={(status) => onPatch({ status })}
        options={STATUS_OPTIONS}
        width={118}
      />
      <FilterSelect
        label="State"
        value={search.state}
        onValueChange={(state) => onPatch({ state })}
        options={toOptions(states)}
        width={100}
      />
      <FilterSelect
        label="County"
        value={search.county}
        onValueChange={(county) => onPatch({ county })}
        options={toOptions(counties)}
        width={118}
      />
      <div className="flex flex-col gap-0.5">
        <FilterSelect
          label="Industry"
          value={search.industry}
          onValueChange={(industry) => onPatch({ industry })}
          options={toOptions(industries)}
          width={130}
        />
      </div>
      <FilterSelect
        label="Created"
        value={created}
        allLabel={null}
        onValueChange={(value) => {
          const preset = (value ?? DEFAULT_CREATED) as CreatedPreset;
          if (preset === "custom") {
            onPatch({ created: "custom" });
            setRangeOpen(true);
          } else {
            onPatch({
              created: preset === DEFAULT_CREATED ? undefined : preset,
              created_after: undefined,
              created_before: undefined,
            });
          }
        }}
        options={CREATED_OPTIONS.map((option) =>
          option.value === created
            ? {
                ...option,
                label: createdLabel(created, {
                  after: search.created_after,
                  before: search.created_before,
                }),
              }
            : option,
        )}
        width={120}
      />
      {created === "custom" ? (
        <Popover open={rangeOpen} onOpenChange={setRangeOpen}>
          <PopoverTrigger asChild>
            <Button variant="secondary" size="sm" aria-label="Edit the custom created range">
              <CalendarRange aria-hidden />
              {createdLabel("custom", {
                after: search.created_after,
                before: search.created_before,
              })}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-72 p-3" aria-label="Custom created range">
            <CustomRangeForm
              key={`${search.created_after ?? ""}|${search.created_before ?? ""}`}
              initialAfter={search.created_after ?? ""}
              initialBefore={search.created_before ?? ""}
              onApply={applyRange}
            />
          </PopoverContent>
        </Popover>
      ) : null}
    </FilterBar>
  );
}

function CustomRangeForm({
  initialAfter,
  initialBefore,
  onApply,
}: {
  initialAfter: string;
  initialBefore: string;
  onApply: (after: string, before: string) => void;
}) {
  const [after, setAfter] = useState(initialAfter);
  const [before, setBefore] = useState(initialBefore);
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        onApply(after, before);
      }}
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="runs-created-after">Created from</Label>
        <Input
          id="runs-created-after"
          type="date"
          inputSize="toolbar"
          value={after}
          onChange={(event) => setAfter(event.target.value)}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="runs-created-before">Created until</Label>
        <Input
          id="runs-created-before"
          type="date"
          inputSize="toolbar"
          value={before}
          onChange={(event) => setBefore(event.target.value)}
        />
      </div>
      <p className="text-[12px] text-muted">Leave both empty to list every run.</p>
      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            setAfter("");
            setBefore("");
          }}
        >
          Clear
        </Button>
        <Button type="submit" variant="primary" size="sm">
          Apply
        </Button>
      </div>
    </form>
  );
}
