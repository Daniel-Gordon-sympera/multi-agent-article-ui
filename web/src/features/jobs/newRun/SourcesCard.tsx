/**
 * Card "Sources" — mockup §3.4: two radio cards. Finder (up to `sites` sites per job; judged
 * domains remembered 180 days) or the curated seeds of this county from Data Sources (live
 * count; disabled when none is active). Only the location mode shows this card.
 */
import { Controller, useFormContext } from "react-hook-form";
import type { Source } from "@/api/types/bff";
import { Card, CardHeader } from "@/components/Card";
import { RadioCard, RadioGroup } from "@/components/ui/radio-group";
import { formatLocation, pluralize } from "@/lib/format";
import { matchingSeeds, type NewRunValues } from "./newRunSchema";

export function SourcesCard({ sources, loading }: { sources: Source[]; loading: boolean }) {
  const form = useFormContext<NewRunValues>();
  const values = form.watch();
  const seeds = matchingSeeds(values, sources);
  const place =
    values.county && values.state_code
      ? formatLocation(values.county, values.state_code)
      : "this county";
  const noSeeds = !loading && seeds.length === 0;

  return (
    <Card aria-labelledby="new-run-sources-title">
      <CardHeader
        id="new-run-sources-title"
        title="Sources"
        subtitle="Who supplies the sites to explore"
      />
      <Controller
        control={form.control}
        name="source_mode"
        render={({ field }) => (
          <RadioGroup
            value={field.value}
            onValueChange={(value) => field.onChange(value as NewRunValues["source_mode"])}
            aria-label="Sources"
          >
            <RadioCard
              id="source-mode-finder"
              value="finder"
              checked={field.value === "finder"}
              title="Let the finder search and rank sites"
              description={`Up to ${pluralize(values.settings.sites, "site")} per job (setting: sites). Judged domains are remembered for 180 days, so repeat runs are cheaper.`}
            />
            <RadioCard
              id="source-mode-seeds"
              value="seeds"
              checked={field.value === "seeds"}
              disabled={noSeeds}
              title="Use the curated seeds for this county"
              description={
                loading
                  ? `Counting the active sources for ${place}…`
                  : noSeeds
                    ? `No active source matches ${place}${values.industries.length ? " and these industries" : ""} in Data Sources yet. Add or promote one there to use seeds.`
                    : `${pluralize(seeds.length, "active source")} match ${place} in Data Sources. Skips the finder; each seed becomes a site run.`
              }
            />
          </RadioGroup>
        )}
      />
    </Card>
  );
}
