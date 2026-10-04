/**
 * Search-param schemas of the Job detail tabs (contract §5.1): every filter, the density, the
 * visible columns, the keyset cursor and the open drawer live in the URL.
 */
import type { z } from "zod";
import { optionalEnum, optionalString, tableSearchSchema } from "@/lib/url";

export const companiesTabSearchSchema = tableSearchSchema.extend({
  org_kind: optionalString,
  hq_scope: optionalString,
  industry: optionalString,
  revenue_bin: optionalString,
  /** "One row per company" switch → `/v1/jobs/{id}/flags`. */
  view: optionalEnum(["mentions", "flags"]),
  q: optionalString,
});

export const summariesTabSearchSchema = tableSearchSchema.extend({
  industry: optionalString,
  materiality: optionalString,
  signal: optionalString,
  q: optionalString,
  /** Summary id whose record drawer is open. */
  record: optionalString,
});

export const articlesTabSearchSchema = tableSearchSchema.extend({
  domain: optionalString,
  origin: optionalString,
  q: optionalString,
});

export const siteRunsTabSearchSchema = tableSearchSchema.extend({
  status: optionalString,
  /** Site run whose work items drawer is open. */
  work: optionalString,
  verdict: optionalString,
  tier: optionalString,
  chosen: optionalEnum(["true", "false"]),
});

export const sectionsTabSearchSchema = tableSearchSchema.extend({
  kept: optionalEnum(["true", "false"]),
  origin: optionalString,
  q: optionalString,
});

export const tasksTabSearchSchema = tableSearchSchema.extend({
  kind: optionalString,
  status: optionalString,
  /** "Show as tree" — on by default; `flat` lists the tasks sorted by id. */
  layout: optionalEnum(["tree", "flat"]),
  /** Task id whose details dialog is open. */
  task: optionalString,
});

export const eventsTabSearchSchema = tableSearchSchema.extend({
  stage: optionalString,
  event: optionalString,
  status: optionalString,
});

export type CompaniesTabSearch = z.infer<typeof companiesTabSearchSchema>;
export type SummariesTabSearch = z.infer<typeof summariesTabSearchSchema>;
export type ArticlesTabSearch = z.infer<typeof articlesTabSearchSchema>;
export type SiteRunsTabSearch = z.infer<typeof siteRunsTabSearchSchema>;
export type SectionsTabSearch = z.infer<typeof sectionsTabSearchSchema>;
export type TasksTabSearch = z.infer<typeof tasksTabSearchSchema>;
export type EventsTabSearch = z.infer<typeof eventsTabSearchSchema>;
