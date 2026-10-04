/**
 * Card "Target" — mockup §3.4: segmented Mode control, State select + County input, the finder
 * location phrase, the Industries token input and the fan-out preview. The Site URL and Seeds
 * modes swap the location/industry fields for a URL input or the active sources as checkboxes.
 */
import { useEffect, useRef } from "react";
import { Controller, useFormContext } from "react-hook-form";
import type { Source } from "@/api/types/bff";
import { Card, CardHeader } from "@/components/Card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { FanOutPreview } from "./FanOutPreview";
import { FormField } from "./FormField";
import { IndustryTokenInput } from "./IndustryTokenInput";
import { defaultLocationPhrase, type NewRunValues, type RunMode } from "./newRunSchema";
import { US_STATES } from "./states";

const MODE_LABELS: Record<RunMode, string> = {
  location_industry: "Location + industries",
  url: "Site URL",
  seeds: "Seeds from Data Sources",
};

const MODE_HELP: Record<RunMode, string> = {
  location_industry:
    "The finder searches the web for local news sites that cover each industry, ranks them, and explores the top sites.",
  url: "One site, no finder: the pipeline explores this site's sections and discovers its articles.",
  seeds:
    "No finder: every ticked Data Source becomes a site run of one job for this county. Industries are optional and only label the job.",
};

export interface TargetCardProps {
  sources: Source[];
  sourcesLoading: boolean;
}

export function TargetCard({ sources, sourcesLoading }: TargetCardProps) {
  const form = useFormContext<NewRunValues>();
  const { errors } = form.formState;
  const [mode, county, stateCode, location] = form.watch([
    "mode",
    "county",
    "state_code",
    "location",
  ]);

  // Keep the finder phrase in step with county/state until the operator edits it.
  const lastAuto = useRef(defaultLocationPhrase(county, stateCode));
  useEffect(() => {
    const next = defaultLocationPhrase(county, stateCode);
    if (location === "" || location === lastAuto.current) {
      if (next !== location) form.setValue("location", next, { shouldDirty: false });
    }
    lastAuto.current = next;
  }, [county, form, location, stateCode]);

  return (
    <Card aria-labelledby="new-run-target-title">
      <CardHeader
        id="new-run-target-title"
        title="Target"
        subtitle="Where to look and what to look for"
      />
      <FormField id="new-run-mode" label="How should the pipeline find articles?" asGroup>
        {() => (
          <Controller
            control={form.control}
            name="mode"
            render={({ field }) => (
              <ToggleGroup
                type="single"
                aria-label="Mode"
                value={field.value}
                onValueChange={(value) => {
                  if (value) field.onChange(value as RunMode);
                }}
              >
                {(Object.keys(MODE_LABELS) as RunMode[]).map((value) => (
                  <ToggleGroupItem key={value} value={value}>
                    {MODE_LABELS[value]}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            )}
          />
        )}
      </FormField>
      <p className="-mt-2 text-[13px] text-muted">{MODE_HELP[mode]}</p>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="new-run-state" label="State" error={errors.state_code?.message}>
          {({ id, describedBy, invalid }) => (
            <Controller
              control={form.control}
              name="state_code"
              render={({ field }) => (
                <Select value={field.value || undefined} onValueChange={field.onChange}>
                  <SelectTrigger
                    id={id}
                    size="form"
                    aria-label="State"
                    aria-describedby={describedBy}
                    aria-invalid={invalid || undefined}
                    className={invalid ? "border-status-fail-fg" : undefined}
                  >
                    <SelectValue placeholder="Choose a state" />
                  </SelectTrigger>
                  <SelectContent>
                    {US_STATES.map((state) => (
                      <SelectItem key={state.code} value={state.code}>
                        {state.name} ({state.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          )}
        </FormField>
        <FormField
          id="new-run-county"
          label="County"
          error={errors.county?.message}
          helper="Required for every job: HQ scope and entity flags are derived relative to it."
        >
          {({ id, describedBy, invalid }) => (
            <Input
              id={id}
              aria-describedby={describedBy}
              invalid={invalid}
              autoComplete="off"
              placeholder="Orange"
              {...form.register("county")}
            />
          )}
        </FormField>
      </div>

      {mode === "location_industry" ? (
        <FormField
          id="new-run-location"
          label="Location phrase for the finder"
          error={errors.location?.message}
          helper="Pre-filled from the county; edit if the local press uses a different name."
        >
          {({ id, describedBy, invalid }) => (
            <Input
              id={id}
              aria-describedby={describedBy}
              invalid={invalid}
              placeholder="Orlando, FL"
              {...form.register("location")}
            />
          )}
        </FormField>
      ) : null}

      {mode === "url" ? (
        <FormField
          id="new-run-url"
          label="Site URL"
          error={errors.url?.message}
          helper="The home page or a section of the site; the pipeline explores it from there."
        >
          {({ id, describedBy, invalid }) => (
            <Input
              id={id}
              type="url"
              inputMode="url"
              aria-describedby={describedBy}
              invalid={invalid}
              placeholder="https://orlandomagazine.com"
              {...form.register("url")}
            />
          )}
        </FormField>
      ) : null}

      {mode !== "url" ? (
        <FormField
          id="new-run-industries"
          label={mode === "seeds" ? "Industries (optional)" : "Industries"}
          error={errors.industries?.message}
          helper={
            mode === "seeds"
              ? "Pick from the NAICS industry catalog to label the job; the seeds you tick decide the sites."
              : "Pick from the NAICS industry catalog. Each industry becomes its own job for this county."
          }
        >
          {({ id, describedBy, invalid }) => (
            <Controller
              control={form.control}
              name="industries"
              render={({ field }) => (
                <IndustryTokenInput
                  id={id}
                  value={field.value}
                  onChange={field.onChange}
                  invalid={invalid}
                  describedBy={describedBy}
                />
              )}
            />
          )}
        </FormField>
      ) : null}

      {mode === "seeds" ? (
        <SeedPicker sources={sources} loading={sourcesLoading} error={errors.seed_ids?.message} />
      ) : null}

      <FanOutPreview sources={sources} />
    </Card>
  );
}

function SeedPicker({
  sources,
  loading,
  error,
}: {
  sources: Source[];
  loading: boolean;
  error?: string;
}) {
  const form = useFormContext<NewRunValues>();
  const [selected, county, stateCode] = form.watch(["seed_ids", "county", "state_code"]);
  const place = county && stateCode ? `${county} County, ${stateCode}` : "this county";
  const setAll = (checked: boolean) =>
    form.setValue("seed_ids", checked ? sources.map((s) => s.id) : [], {
      shouldDirty: true,
      shouldValidate: true,
    });
  return (
    <FormField
      id="new-run-seeds"
      label="Seeds from Data Sources"
      error={error}
      asGroup
      helper={
        loading
          ? "Loading the active sources…"
          : sources.length === 0
            ? `No active source is listed for ${place} yet — add one under Data Sources.`
            : `${sources.length} active sources match ${place}; each ticked seed becomes a site run.`
      }
    >
      {() => (
        <div className="flex flex-col gap-2 rounded-control border border-border-strong p-3">
          <div className="flex items-center gap-3 text-[12px]">
            <button
              type="button"
              className="text-brand-600 hover:underline"
              onClick={() => setAll(true)}
            >
              Select all
            </button>
            <button
              type="button"
              className="text-brand-600 hover:underline"
              onClick={() => setAll(false)}
            >
              Select none
            </button>
          </div>
          {sources.map((source) => {
            const id = `seed-${source.id}`;
            const checked = selected.includes(source.id);
            return (
              <div key={source.id} className="flex items-start gap-2.5">
                <Checkbox
                  id={id}
                  checked={checked}
                  className="mt-0.5"
                  onCheckedChange={(value) =>
                    form.setValue(
                      "seed_ids",
                      value === true
                        ? [...selected, source.id]
                        : selected.filter((v) => v !== source.id),
                      { shouldDirty: true, shouldValidate: true },
                    )
                  }
                />
                <label htmlFor={id} className="flex min-w-0 cursor-pointer flex-col text-[13px]">
                  <span className="font-semibold text-ink">{source.name}</span>
                  <span className="truncate text-[12px] text-muted">
                    {source.domain} · {source.industries.join(", ") || "all industries"}
                  </span>
                </label>
              </div>
            );
          })}
        </div>
      )}
    </FormField>
  );
}
