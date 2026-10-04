/** Search-param schemas of the Jobs routes (contract §5.1); `z.infer` gives the typed search. */
import { z } from "zod";
import {
  optionalEnum,
  optionalString,
  tableSearchSchema,
  densitySchema,
  listParam,
} from "@/lib/url";

export const jobsSearchSchema = tableSearchSchema.extend({
  status: optionalString,
  state: optionalString,
  county: optionalString,
  industry: optionalString,
  created: optionalEnum(["today", "7d", "30d", "custom"]),
  q: optionalString,
});

export const scoutsSearchSchema = z.object({
  state: optionalString,
  industry: optionalString,
  q: optionalString,
  density: densitySchema,
  cols: listParam,
});

export const newRunSearchSchema = z.object({
  scout: optionalString,
  mode: optionalEnum(["location_industry", "url", "seeds"]),
  scoutMode: optionalEnum(["save"]),
});

export type JobsSearch = z.infer<typeof jobsSearchSchema>;
export type ScoutsSearch = z.infer<typeof scoutsSearchSchema>;
export type NewRunSearch = z.infer<typeof newRunSearchSchema>;
