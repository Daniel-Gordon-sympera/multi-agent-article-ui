/**
 * The Runs "Created" filter (mockup §3.2 / §6.8): presets Today · Last 7 days (default) ·
 * Last 30 days · Custom range, mapped to the API's `created_after` / `created_before`. Bounds
 * are cut at UTC midnight so the query key stays stable within a day.
 */
import type { FilterOption } from "@/components/FilterSelect";

export type CreatedPreset = "today" | "7d" | "30d" | "custom";

export const DEFAULT_CREATED: CreatedPreset = "7d";

export const CREATED_OPTIONS: FilterOption[] = [
  { value: "7d", label: "Last 7 days" },
  { value: "today", label: "Today" },
  { value: "30d", label: "Last 30 days" },
  { value: "custom", label: "Custom range" },
];

export interface CreatedBounds {
  created_after?: string;
  created_before?: string;
}

export interface CustomRange {
  after?: string;
  before?: string;
}

function startOfUtcDay(date: Date, daysBack = 0): string {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() - daysBack);
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

/** `YYYY-MM-DD` → ISO instant at the start (or the end) of that UTC day. */
function isoDayBound(day: string | undefined, end: boolean): string | undefined {
  if (!day || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return undefined;
  return end ? `${day}T23:59:59.999Z` : `${day}T00:00:00.000Z`;
}

export function createdBounds(
  preset: CreatedPreset | undefined,
  custom: CustomRange = {},
  now: Date = new Date(),
): CreatedBounds {
  switch (preset ?? DEFAULT_CREATED) {
    case "today":
      return { created_after: startOfUtcDay(now) };
    case "7d":
      return { created_after: startOfUtcDay(now, 7) };
    case "30d":
      return { created_after: startOfUtcDay(now, 30) };
    case "custom":
      return {
        created_after: isoDayBound(custom.after, false),
        created_before: isoDayBound(custom.before, true),
      };
  }
}

/** The select's trigger text: "Created: last 7 days" / "Created: Oct 1 – Oct 4". */
export function createdLabel(preset: CreatedPreset | undefined, custom: CustomRange = {}): string {
  const current = preset ?? DEFAULT_CREATED;
  if (current !== "custom") {
    const option = CREATED_OPTIONS.find((o) => o.value === current);
    return option ? option.label.replace(/^Last/, "last") : current;
  }
  if (!custom.after && !custom.before) return "any time";
  if (custom.after && custom.before) return `${custom.after} – ${custom.before}`;
  return custom.after ? `since ${custom.after}` : `until ${custom.before}`;
}
