/**
 * The New run / Scout form model (mockup §3.4): zod schema, defaults (mockup §4.8), the
 * pre-fill mappers (Scout, job, source) and the mappers to the BFF inputs (`BatchInput`,
 * `ScoutInput`). Everything here is pure so the form logic is unit-testable.
 */
import { z } from "zod";
import type { Batch, BatchInput, BatchJob, Scout, ScoutInput, Source } from "@/api/types/bff";
import type { JobKind, JobRecord, JobSettings } from "@/api/types/jobs";
import { jobIndustry } from "@/features/jobs/jobTitle";
import { formatLocation } from "@/lib/format";
import { domainOf } from "@/lib/url";
import { stateCodeOf } from "./states";

export const RUN_MODES = ["location_industry", "url", "seeds"] as const;
export type RunMode = (typeof RUN_MODES)[number];

/** Platform defaults shown in the Advanced grid (mockup §4.8). */
export const DEFAULT_SETTINGS = {
  days: 30,
  sites: 5,
  site_timeout: 0,
  max_runtime: 18000,
  memory_mode: "full" as const,
  reanalyze: "reuse" as const,
};

const integer = (min: number, label: string) =>
  z
    .number({ error: `${label} must be a whole number.` })
    .int(`${label} must be a whole number.`)
    .min(min, `${label} must be at least ${min}.`);

export const newRunSchema = z
  .object({
    mode: z.enum(RUN_MODES),
    state_code: z.string().trim().length(2, "Choose a state."),
    county: z.string().trim().min(1, "County is required for every job."),
    location: z.string().trim(),
    industries: z.array(z.string().trim().min(1)),
    url: z.string().trim(),
    seed_ids: z.array(z.string()),
    source_mode: z.enum(["finder", "seeds"]),
    settings: z.object({
      days: integer(1, "Days to look back"),
      sites: integer(1, "Sites per job"),
      site_timeout: integer(0, "Site timeout"),
      max_runtime: integer(60, "Max runtime"),
      memory_mode: z.enum(["full", "pages_only", "off"]),
      reanalyze: z.enum(["reuse", "reanalyze"]),
    }),
    save_as_scout: z.boolean(),
    scout_name: z.string().trim(),
  })
  .superRefine((values, context) => {
    if (values.mode === "location_industry") {
      if (values.industries.length === 0) {
        context.addIssue({
          code: "custom",
          path: ["industries"],
          message: "Pick at least one industry — each one becomes its own job.",
        });
      }
      if (!values.location) {
        context.addIssue({
          code: "custom",
          path: ["location"],
          message: "The finder needs a location phrase.",
        });
      }
    }
    if (values.mode === "url" && !isHttpUrl(values.url)) {
      context.addIssue({
        code: "custom",
        path: ["url"],
        message: "Enter the site's address, starting with http:// or https://.",
      });
    }
    if (values.mode === "seeds" && values.seed_ids.length === 0) {
      context.addIssue({
        code: "custom",
        path: ["seed_ids"],
        message: "Tick at least one source; each seed becomes a site run.",
      });
    }
    if (values.save_as_scout && values.scout_name.length < 2) {
      context.addIssue({
        code: "custom",
        path: ["scout_name"],
        message: "Give the Scout a name of at least 2 characters.",
      });
    }
  });

export type NewRunValues = z.infer<typeof newRunSchema>;

export function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function defaultNewRunValues(overrides: Partial<NewRunValues> = {}): NewRunValues {
  return {
    mode: "location_industry",
    state_code: "",
    county: "",
    location: "",
    industries: [],
    url: "",
    seed_ids: [],
    source_mode: "finder",
    settings: { ...DEFAULT_SETTINGS },
    save_as_scout: false,
    scout_name: "",
    ...overrides,
  };
}

/** "Orange" + "FL" → "Orange County, FL" (the pre-filled finder phrase). */
export function defaultLocationPhrase(county: string, stateCode: string): string {
  if (!county.trim() || !stateCode.trim()) return "";
  return formatLocation(county, stateCode);
}

function settingsFrom(settings: JobSettings | null | undefined): NewRunValues["settings"] {
  const s = settings ?? {};
  return {
    days: typeof s.days === "number" ? s.days : DEFAULT_SETTINGS.days,
    sites: typeof s.sites === "number" ? s.sites : DEFAULT_SETTINGS.sites,
    site_timeout:
      typeof s.site_timeout === "number" ? s.site_timeout : DEFAULT_SETTINGS.site_timeout,
    max_runtime: typeof s.max_runtime === "number" ? s.max_runtime : DEFAULT_SETTINGS.max_runtime,
    memory_mode: s.memory_mode ?? DEFAULT_SETTINGS.memory_mode,
    reanalyze: s.reanalyze ? "reanalyze" : "reuse",
  };
}

/** `?scout=<id>` — edit / run a saved Scout. */
export function valuesFromScout(scout: Scout): NewRunValues {
  // A Scout keeps no explicit seed selection: a `seeds` Scout is the location mode with the
  // "curated seeds" source option, resolved against Data Sources at run time (contract §4.5).
  const mode: RunMode = scout.kind === "url" ? "url" : "location_industry";
  return defaultNewRunValues({
    mode,
    state_code: stateCodeOf(scout.state_code),
    county: scout.county,
    location: scout.location ?? defaultLocationPhrase(scout.county, scout.state_code),
    industries: [...scout.industries],
    url: scout.url ?? "",
    source_mode: scout.kind === "seeds" || scout.source_mode === "seeds" ? "seeds" : "finder",
    settings: settingsFrom(scout.settings),
    save_as_scout: false,
    scout_name: scout.name,
  });
}

/** `?from=<jobId>` — run a job again with the same kind, input, county, state and settings. */
export function valuesFromJob(job: JobRecord): NewRunValues {
  const industry = jobIndustry(job);
  const kind: JobKind = job.kind;
  return defaultNewRunValues({
    mode: kind === "seeds" ? "location_industry" : kind,
    source_mode: kind === "seeds" ? "seeds" : "finder",
    state_code: stateCodeOf(job.state_code),
    county: job.county,
    location:
      typeof job.input.location === "string" && job.input.location
        ? job.input.location
        : defaultLocationPhrase(job.county, job.state_code),
    industries: industry ? [industry] : [],
    url: typeof job.input.url === "string" ? job.input.url : "",
    settings: settingsFrom(job.settings),
  });
}

/** `?mode=seeds&source=<id>` — Seeds mode with that source ticked. */
export function valuesFromSource(source: Source): NewRunValues {
  return defaultNewRunValues({
    mode: "seeds",
    state_code: stateCodeOf(source.state_code),
    county: source.county,
    location: defaultLocationPhrase(source.county, source.state_code),
    industries: [...source.industries],
    seed_ids: [source.id],
    source_mode: "seeds",
  });
}

/** The API kind the form resolves to: location + curated seeds becomes a `seeds` job. */
export function resolvedKind(values: Pick<NewRunValues, "mode" | "source_mode">): JobKind {
  if (values.mode === "location_industry") {
    return values.source_mode === "seeds" ? "seeds" : "location_industry";
  }
  return values.mode;
}

/** How many `POST /v1/jobs` legs the batch fans out to (contract §4.5). */
export function legsOf(values: Pick<NewRunValues, "mode" | "source_mode" | "industries">): number {
  return resolvedKind(values) === "location_industry" ? Math.max(1, values.industries.length) : 1;
}

export function settingsToApi(settings: NewRunValues["settings"]): JobSettings {
  return {
    days: settings.days,
    sites: settings.sites,
    site_timeout: settings.site_timeout,
    max_runtime: settings.max_runtime,
    memory_mode: settings.memory_mode,
    reanalyze: settings.reanalyze === "reanalyze",
  };
}

/** Active sources that match the county/state and, when industries are set, any of them. */
export function matchingSeeds(values: NewRunValues, sources: readonly Source[]): Source[] {
  const county = values.county.trim().toLowerCase();
  const state = values.state_code.toUpperCase();
  const wanted = new Set(values.industries.map((i) => i.toLowerCase()));
  return sources.filter(
    (source) =>
      source.status === "active" &&
      source.county.trim().toLowerCase() === county &&
      source.state_code.toUpperCase() === state &&
      (wanted.size === 0 || source.industries.some((i) => wanted.has(i.toLowerCase()))),
  );
}

export function toBatchInput(
  values: NewRunValues,
  sources: readonly Source[],
  options: { scoutId?: string } = {},
): BatchInput {
  const kind = resolvedKind(values);
  const input: BatchInput = {
    kind,
    county: values.county.trim(),
    state_code: values.state_code.toUpperCase(),
    industries: [...values.industries],
    settings: settingsToApi(values.settings),
  };
  if (kind === "location_industry") input.location = values.location.trim();
  if (kind === "url") input.url = values.url.trim();
  if (kind === "seeds") {
    const chosen =
      values.mode === "seeds"
        ? sources.filter((source) => values.seed_ids.includes(source.id))
        : matchingSeeds(values, sources);
    input.seeds = chosen.map((source) => ({ title: source.name, url: source.url }));
  }
  if (options.scoutId) input.scout_id = options.scoutId;
  else if (values.save_as_scout) input.save_as_scout = { name: values.scout_name.trim() };
  return input;
}

export function toScoutInput(values: NewRunValues): ScoutInput {
  const kind = resolvedKind(values);
  return {
    name: values.scout_name.trim(),
    kind,
    county: values.county.trim(),
    state_code: values.state_code.toUpperCase(),
    location: kind === "location_industry" ? values.location.trim() : null,
    url: kind === "url" ? values.url.trim() : null,
    industries: [...values.industries],
    source_mode: kind === "seeds" ? "seeds" : "finder",
    settings: settingsToApi(values.settings),
  };
}

/** "Orange County, FL · Construction" — one fan-out preview row per leg. */
export function legLabels(values: NewRunValues, seedCount: number): string[] {
  const place = formatLocation(values.county || "—", values.state_code || "—");
  const kind = resolvedKind(values);
  if (kind === "location_industry") {
    const industries = values.industries.length ? values.industries : ["—"];
    return industries.map((industry) => `${place} · ${industry}`);
  }
  if (kind === "url") return [`${place} · ${domainOf(values.url) || "site URL"}`];
  const what = values.industries.length ? values.industries.join(", ") : `${seedCount} seeds`;
  return [`${place} · ${what}`];
}

/** "~30–60 min" for 5 sites: a coarse per-site budget, not a promise. */
export function estimatedMinutes(sites: number): string {
  const n = Math.max(1, sites);
  return `~${n * 6}–${n * 12} min`;
}

/** Legs of a batch answer that did not reach the API (contract §4.5: `jobs[].error`). */
export function failedLegs(batch: Batch | null): BatchJob[] {
  return batch ? batch.jobs.filter((leg) => leg.error || !leg.job_id) : [];
}

/** Which pre-fill wins on `/jobs/new`: `?scout=` → `?from=` → `?source=` → the defaults. */
export function initialValuesFor(
  search: {
    scout?: string;
    duplicate?: number;
    from?: string;
    source?: string;
    mode?: RunMode;
    scoutMode?: "save";
  },
  scout: Scout | null | undefined,
  job: JobRecord | null | undefined,
  source: Source | null | undefined,
): NewRunValues {
  if (search.scout && scout && search.duplicate) {
    // Duplicate: the saved setup as a starting point for a new Scout, not an edit of it.
    return { ...valuesFromScout(scout), save_as_scout: true, scout_name: `${scout.name} (copy)` };
  }
  if (search.scout && scout) return valuesFromScout(scout);
  if (search.from && job) return valuesFromJob(job);
  if (search.source && source) return valuesFromSource(source);
  return defaultNewRunValues({
    mode: search.mode ?? "location_industry",
    save_as_scout: search.scoutMode === "save",
  });
}
