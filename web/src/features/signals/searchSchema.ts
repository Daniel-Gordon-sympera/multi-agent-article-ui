/** Search-param schema of the Signals explorer (contract §5.1 + §4.4). */
import { optionalString, tableSearchSchema } from "@/lib/url";
import type { z } from "zod";

/**
 * Explorer search params: `view` (saved view id), `detail` (open the drawer by mention id — the
 * contract's `signal?` opener, renamed because `signal` is also the cross-job *type* filter of
 * §4.4), every §4.4 filter, and the shared table state.
 */
export const signalsSearchSchema = tableSearchSchema.extend({
  view: optionalString,
  detail: optionalString,
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
