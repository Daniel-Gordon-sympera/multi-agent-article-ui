/**
 * Sticky Summary card — mockup §3.4: Kind · County · State · Jobs to create · Sources · Prompt
 * version · Estimated cost (+ footnote), the "Save as Scout" checkbox with the Scout name, and
 * the stacked buttons: `[▶ Create N jobs]` primary + `[Cancel]`; with `?scout=` the buttons read
 * `[▶ Run Scout]` and `[Save changes]`.
 */
import { Link } from "@tanstack/react-router";
import { Bookmark, Play, Save } from "lucide-react";
import { Controller, useFormContext } from "react-hook-form";
import type { Estimate, Source } from "@/api/types/bff";
import { Button } from "@/components/Button";
import { Card, CardHeader } from "@/components/Card";
import { KeyValueGrid } from "@/components/KeyValueGrid";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { pluralize } from "@/lib/format";
import { estimateFootnote, estimateText } from "./estimateText";
import { FormField } from "./FormField";
import { legsOf, matchingSeeds, resolvedKind, type NewRunValues } from "./newRunSchema";

export interface SummaryCardProps {
  sources: Source[];
  promptVersion: string | null | undefined;
  estimate: Estimate | undefined;
  estimateLoading: boolean;
  estimateFailed?: boolean;
  /** Editing a saved Scout (`?scout=`). */
  scoutId?: string;
  dirty: boolean;
  pending: boolean;
  onRunScout: () => void;
  onSaveScout: () => void;
  onSaveScoutOnly: () => void;
}

export function SummaryCard({
  sources,
  promptVersion,
  estimate,
  estimateLoading,
  estimateFailed = false,
  scoutId,
  dirty,
  pending,
  onRunScout,
  onSaveScout,
  onSaveScoutOnly,
}: SummaryCardProps) {
  const form = useFormContext<NewRunValues>();
  const values = form.watch();
  const kind = resolvedKind(values);
  const legs = legsOf(values);
  const seedCount =
    values.mode === "seeds" ? values.seed_ids.length : matchingSeeds(values, sources).length;
  const sourcesText =
    kind === "location_industry"
      ? `Finder · top ${pluralize(values.settings.sites, "site")}`
      : kind === "url"
        ? "One site URL"
        : `${pluralize(seedCount, "seed")} from Data Sources`;
  const scoutNameError = form.formState.errors.scout_name?.message;

  return (
    <Card aria-labelledby="new-run-summary-title" className="lg:sticky lg:top-6">
      <CardHeader id="new-run-summary-title" title="Summary" />
      <KeyValueGrid
        items={[
          { label: "Kind", value: kind, mono: true },
          {
            label: "County · State",
            value:
              values.county || values.state_code
                ? `${values.county || "—"}${values.county && !/county$/i.test(values.county) ? " County" : ""} · ${values.state_code || "—"}`
                : "—",
          },
          { label: "Jobs to create", value: String(legs) },
          { label: "Sources", value: sourcesText },
          { label: "Prompt version", value: promptVersion ?? "—", mono: true },
          {
            label: "Estimated cost",
            value: estimateText(estimate, estimateLoading, estimateFailed),
          },
        ]}
      />
      <p className="text-[12px] text-muted">
        {estimateFootnote(estimate, estimateLoading, estimateFailed)}
      </p>
      <div className="border-t border-border" />
      {scoutId ? (
        <FormField id="new-run-scout-name" label="Scout name" error={scoutNameError}>
          {({ id, describedBy, invalid }) => (
            <Input
              id={id}
              aria-describedby={describedBy}
              invalid={invalid}
              {...form.register("scout_name")}
            />
          )}
        </FormField>
      ) : (
        <div className="flex flex-col gap-3">
          <Controller
            control={form.control}
            name="save_as_scout"
            render={({ field }) => (
              <div className="flex items-center gap-2.5">
                <Checkbox
                  id="new-run-save-as-scout"
                  checked={field.value}
                  onCheckedChange={(value) => field.onChange(value === true)}
                />
                <Label htmlFor="new-run-save-as-scout" className="cursor-pointer text-ink">
                  Save as Scout
                </Label>
              </div>
            )}
          />
          {values.save_as_scout ? (
            <FormField id="new-run-scout-name" label="Scout name" error={scoutNameError}>
              {({ id, describedBy, invalid }) => (
                <Input
                  id={id}
                  aria-describedby={describedBy}
                  invalid={invalid}
                  placeholder="Orange County builders"
                  {...form.register("scout_name")}
                />
              )}
            </FormField>
          ) : null}
        </div>
      )}
      <div className="flex flex-col gap-2">
        {scoutId ? (
          <>
            <Button variant="primary" onClick={onRunScout} loading={pending} disabled={pending}>
              <Play aria-hidden />
              Run Scout
            </Button>
            {dirty ? (
              <p className="text-[12px] text-status-warn-fg" role="status">
                Unsaved changes are not part of this run — save them first.
              </p>
            ) : null}
            <Button variant="secondary" onClick={onSaveScout} disabled={pending || !dirty}>
              <Save aria-hidden />
              Save changes
            </Button>
          </>
        ) : (
          <>
            <Button type="submit" variant="primary" loading={pending} disabled={pending}>
              <Play aria-hidden />
              Create {pluralize(legs, "job")}
            </Button>
            {values.save_as_scout ? (
              <Button variant="secondary" onClick={onSaveScoutOnly} disabled={pending}>
                <Bookmark aria-hidden />
                Save Scout without running
              </Button>
            ) : null}
          </>
        )}
        <Button asChild variant="secondary">
          <Link to="/jobs">Cancel</Link>
        </Button>
      </div>
    </Card>
  );
}
