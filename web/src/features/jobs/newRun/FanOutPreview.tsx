/**
 * Fan-out preview — mockup §3.4: "This will create N jobs" + helper, then one row per leg with
 * a mono brand index tag, "Orange County, FL · Construction" and the sources/duration note.
 */
import { useFormContext } from "react-hook-form";
import type { Source } from "@/api/types/bff";
import { Tag } from "@/components/Tag";
import { pluralize } from "@/lib/format";
import {
  estimatedMinutes,
  legLabels,
  legsOf,
  matchingSeeds,
  resolvedKind,
  type NewRunValues,
} from "./newRunSchema";

export function FanOutPreview({ sources }: { sources: Source[] }) {
  const form = useFormContext<NewRunValues>();
  const values = form.watch();
  const kind = resolvedKind(values);
  const legs = legsOf(values);
  const seedCount =
    values.mode === "seeds" ? values.seed_ids.length : matchingSeeds(values, sources).length;
  const labels = legLabels(values, seedCount);
  const sites = values.settings.sites;
  const note =
    kind === "location_industry"
      ? `finder · top ${pluralize(sites, "site")} · ${estimatedMinutes(sites)}`
      : kind === "url"
        ? `1 site · ${estimatedMinutes(1)}`
        : `${pluralize(seedCount, "seed")} · ${estimatedMinutes(Math.max(1, seedCount))}`;

  return (
    <section aria-labelledby="fan-out-title" className="flex flex-col gap-2.5">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <h3 id="fan-out-title" className="text-[13px] font-semibold text-ink">
          This will create {pluralize(legs, "job")}
        </h3>
        <p className="text-[12px] text-muted">
          {kind === "location_industry"
            ? "(location, [industries]) fans out to one job per industry; they share a batch id so you can track them together"
            : "one job; it still gets a batch id so a Scout can track its runs"}
        </p>
      </div>
      <ol className="flex flex-col gap-1.5">
        {labels.map((label, index) => (
          <li
            key={`${index}-${label}`}
            className="flex flex-wrap items-center justify-between gap-2 rounded-control border border-border bg-surface-2 px-3 py-2.5"
          >
            <span className="flex min-w-0 items-center gap-2.5">
              <Tag tone="brand" mono>
                {index + 1}
              </Tag>
              <span className="truncate text-[13px] font-semibold text-ink">{label}</span>
            </span>
            <span className="text-[12px] text-muted">{note}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
