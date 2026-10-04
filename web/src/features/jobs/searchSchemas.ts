/** Search-param schemas of the Jobs routes (contract §5.1); `z.infer` gives the typed search. */
import { z } from "zod";
import {
  optionalEnum,
  optionalString,
  tableSearchSchema,
  densitySchema,
  listParam,
  positiveIntParam,
} from "@/lib/url";

/** `YYYY-MM-DD` or nothing (custom "Created" range bounds). */
const optionalIsoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .optional()
  .catch(undefined);

export const jobsSearchSchema = tableSearchSchema.extend({
  status: optionalString,
  state: optionalString,
  county: optionalString,
  industry: optionalString,
  created: optionalEnum(["today", "7d", "30d", "custom"]),
  created_after: optionalIsoDate,
  created_before: optionalIsoDate,
  q: optionalString,
  /** `?scout=<id>` lists the runs of one Scout (cross-feature link contract §7). */
  scout: optionalString,
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
  /** With `?scout=`: start a new Scout from that setup instead of editing it (`?duplicate=1`). */
  duplicate: positiveIntParam,
  mode: optionalEnum(["location_industry", "url", "seeds"]),
  scoutMode: optionalEnum(["save"]),
  /** Pre-fill from an existing job (Re-run). */
  from: optionalString,
  /** Pre-select one Data Source in Seeds mode (`?mode=seeds&source=<id>`). */
  source: optionalString,
});

export type JobsSearch = z.infer<typeof jobsSearchSchema>;
export type ScoutsSearch = z.infer<typeof scoutsSearchSchema>;
export type NewRunSearch = z.infer<typeof newRunSearchSchema>;
