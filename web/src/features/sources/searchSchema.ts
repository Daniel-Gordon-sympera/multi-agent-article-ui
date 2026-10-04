/** Search-param schema of the Data Sources route (contract §5.1). */
import { optionalEnum, optionalString, tableSearchSchema } from "@/lib/url";
import type { z } from "zod";

export const sourcesSearchSchema = tableSearchSchema.extend({
  state: optionalString,
  county: optionalString,
  industry: optionalString,
  origin: optionalEnum(["manual", "finder", "csv"]),
  status: optionalEnum(["active", "removed", "all"]),
  q: optionalString,
});

export type SourcesSearch = z.infer<typeof sourcesSearchSchema>;
