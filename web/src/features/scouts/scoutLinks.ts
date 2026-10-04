/**
 * URL contracts between Scouts/Sources and the Jobs screens (engineering contract §7):
 * a Scout's runs live at `/jobs?scout=<id>`, the New run form edits a Scout at
 * `/jobs/new?scout=<id>`, duplicates one at `/jobs/new?scout=<id>&duplicate=1` and starts a
 * seed run at `/jobs/new?mode=seeds&source=<id>`.
 *
 * The `scout`, `duplicate` and `source` keys are not part of B1's zod schemas yet; the router
 * keeps unknown keys in the href (search validation merges, it does not strip), so these
 * helpers widen the typed search objects until B1 adds the keys to `jobsSearchSchema` and
 * `newRunSearchSchema`.
 */
import type { JobsSearch, NewRunSearch } from "@/features/jobs/searchSchemas";

type JobsSearchWithScout = JobsSearch & { scout?: string };
type NewRunSearchWithExtras = NewRunSearch & { duplicate?: number; source?: string };

/** `/jobs?scout=<id>` — the Runs list filtered to one Scout's batches. */
export function runsOfScoutSearch(scoutId: string): JobsSearch {
  const search: JobsSearchWithScout = { scout: scoutId };
  return search;
}

/** `/jobs/new?scout=<id>` — edit the Scout in the New run form. */
export function editScoutSearch(scoutId: string): NewRunSearch {
  return { scout: scoutId };
}

/** `/jobs/new?scout=<id>&duplicate=1` — a copy of the Scout to save under a new name. */
export function duplicateScoutSearch(scoutId: string): NewRunSearch {
  const search: NewRunSearchWithExtras = { scout: scoutId, duplicate: 1 };
  return search;
}

/** `/jobs/new?mode=seeds&source=<id>` — a seed run pre-filled from one Data Source. */
export function seedRunSearch(sourceId: string): NewRunSearch {
  const search: NewRunSearchWithExtras = { mode: "seeds", source: sourceId };
  return search;
}

/** `/jobs/new?scoutMode=save` — the form with "Save as Scout" pre-checked. */
export const NEW_SCOUT_SEARCH: NewRunSearch = { scoutMode: "save" };
