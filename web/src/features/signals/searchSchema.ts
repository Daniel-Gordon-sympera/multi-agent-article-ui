/** Search-param schemas of the signal screens (contract §5.1 + §4.4). */
import { optionalString, tableSearchSchema } from "@/lib/url";
import { z } from "zod";

/**
 * The open drawer: `?detail=<mention id>`. Kept numeric when it is a number so the router
 * writes `detail=9000` rather than the JSON-quoted `detail=%229000%22`; compared as text.
 */
export const mentionIdParam = z
  .union([z.string(), z.number()])
  .transform((value) => {
    const text = String(value).trim();
    if (text === "") return undefined;
    return /^\d+$/.test(text) ? Number(text) : text;
  })
  .optional()
  .catch(undefined);

/**
 * Explorer search params: `view` (saved view id), `detail` (open the drawer by mention id — the
 * contract's `signal?` opener, renamed because `signal` is also the cross-job *type* filter of
 * §4.4), every §4.4 filter, and the shared table state (`density`, `cols`, `after`).
 */
export const signalsSearchSchema = tableSearchSchema.extend({
  view: optionalString,
  detail: mentionIdParam,
  detail_job: z.string().uuid().optional().catch(undefined),
  signal: optionalString,
  materiality: optionalString,
  company_key: optionalString,
  hq_scope: optionalString,
  org_kind: optionalString,
  industry: optionalString,
  job_industry: optionalString,
  state: optionalString,
  county: optionalString,
  revenue_bin: optionalString,
  date_after: optionalString,
  date_before: optionalString,
  job_id: optionalString,
  batch_id: optionalString,
  q: optionalString,
});

export type SignalsSearch = z.infer<typeof signalsSearchSchema>;

/** The §4.4 filter keys in the order the chips render. */
export const SIGNAL_FILTER_KEYS = [
  "date_after",
  "date_before",
  "state",
  "county",
  "job_industry",
  "industry",
  "signal",
  "materiality",
  "revenue_bin",
  "org_kind",
  "hq_scope",
  "company_key",
  "job_id",
  "batch_id",
] as const;

export type SignalFilterKey = (typeof SIGNAL_FILTER_KEYS)[number];

/**
 * Job › Signals tab: the API's exact-match filters (`signal, materiality, org_kind, hq_scope`),
 * industry, revenue bin and search, the table state and the drawer.
 */
export const jobSignalsSearchSchema = tableSearchSchema.extend({
  detail: mentionIdParam,
  detail_job: z.string().uuid().optional().catch(undefined),
  signal: optionalString,
  materiality: optionalString,
  org_kind: optionalString,
  hq_scope: optionalString,
  industry: optionalString,
  revenue_bin: optionalString,
  q: optionalString,
});

export type JobSignalsSearch = z.infer<typeof jobSignalsSearchSchema>;
