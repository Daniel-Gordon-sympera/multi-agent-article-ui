import { describe, expect, it } from "vitest";
import type { Task } from "@/api/types/tasks";
import { buildTaskFixtures } from "@/mocks/fixtures/tasks";
import { createdBounds, createdLabel } from "../runs/createdFilter";
import { apiFiltersFor } from "../runs/useRunsData";
import { buildJobFixtures } from "@/mocks/fixtures/jobs";
import { costRows, stageLabel } from "../overview/costModel";
import { MAIN_JOB_COSTS } from "@/mocks/fixtures/jobIds";
import {
  buildTaskTree,
  flatTaskRows,
  taskStatusCounts,
  taskTarget,
  taskWorker,
} from "../tasks/taskTree";
import {
  defaultNewRunValues,
  legLabels,
  legsOf,
  newRunSchema,
  resolvedKind,
  toBatchInput,
  valuesFromJob,
} from "../newRun/newRunSchema";

const now = new Date("2026-10-04T11:31:00Z");

describe("Runs filters", () => {
  it("maps the Created presets to UTC-midnight bounds and labels them", () => {
    expect(createdBounds(undefined, {}, now)).toEqual({
      created_after: "2026-09-27T00:00:00.000Z",
    });
    expect(createdBounds("today", {}, now)).toEqual({ created_after: "2026-10-04T00:00:00.000Z" });
    expect(createdBounds("custom", { after: "2026-10-01", before: "2026-10-02" }, now)).toEqual({
      created_after: "2026-10-01T00:00:00.000Z",
      created_before: "2026-10-02T23:59:59.999Z",
    });
    expect(createdBounds("custom", {}, now)).toEqual({});
    expect(createdLabel(undefined)).toBe("last 7 days");
    expect(createdLabel("custom", { after: "2026-10-01" })).toBe("since 2026-10-01");
  });

  it("sends search, running state and industry before pagination, newest first", () => {
    const search = { status: "running", industry: "Construction", q: "orange" };
    expect(apiFiltersFor(search)).toMatchObject({
      status: undefined,
      status_group: "running",
      industry: "Construction",
      q: "orange",
      order: "created_desc",
    });
    expect(apiFiltersFor({ ...search, status: "partial" })).toMatchObject({
      status: "partial",
      status_group: undefined,
      industry: "Construction",
    });
  });
});

describe("Cost by stage", () => {
  it("groups the finder stages with the ranker and sizes bars by the costliest stage", () => {
    const rows = costRows(MAIN_JOB_COSTS);
    expect(rows.map((row) => row.label)).toEqual([
      "Classification",
      "Summary",
      "Company pass",
      "Sections agent",
      "Finder + ranker",
    ]);
    expect(rows[0]?.pct).toBe(1);
    expect(rows[4]).toMatchObject({ value: "$0.13", subLabel: "19 calls · 71.0K tokens" });
    expect(stageLabel("finder_classify")).toBe("Finder + ranker");
    expect(stageLabel("custom_stage")).toBe("Custom stage");
  });
});

describe("Task tree", () => {
  const tasks = buildTaskFixtures();

  it("flattens the tree depth-first with children sorted by id", () => {
    const rows = buildTaskTree(tasks);
    expect(rows.map((row) => `${row.depth}:${row.task.id}`)).toEqual([
      "0:48811",
      "1:48812",
      "2:48813",
      "3:48817",
      "4:48902",
      "4:48911",
      "4:48915",
      "4:48920",
      "2:48814",
      "3:48818",
      "2:48816",
      "0:48930",
    ]);
    expect(rows[0]?.hasChildren).toBe(true);
    expect(rows[4]?.hasChildren).toBe(false);
  });

  it("promotes orphans to the root and sorts the flat layout by id", () => {
    const subset = tasks.filter((task) => task.kind === "analyze_article");
    expect(buildTaskTree(subset).every((row) => row.depth === 0)).toBe(true);
    expect(flatTaskRows(tasks).map((row) => row.task.id)).toEqual(
      [...tasks].map((t) => t.id).sort((a, b) => a - b),
    );
  });

  it("counts statuses and derives targets and workers", () => {
    expect(taskStatusCounts(tasks)).toEqual({
      queued: 1,
      running: 1,
      succeeded: 8,
      failed: 1,
      dead: 1,
      cancelled: 0,
    });
    const base = tasks[0] as Task;
    expect(taskTarget({ ...base, payload: { article_id: 71334, title: "Kirkman" } })).toBe(
      "#71334 · Kirkman",
    );
    expect(taskTarget({ ...base, payload: { seed_url: "https://a.com/x" } })).toBe("a.com/x");
    expect(taskTarget({ ...base, payload: {} })).toBe("—");
    expect(taskWorker({ ...base, claimed_by: "finder-1@host" })).toBe("finder-1");
  });
});

describe("New run model", () => {
  it("validates per mode", () => {
    const empty = newRunSchema.safeParse(defaultNewRunValues());
    expect(empty.success).toBe(false);
    const paths = empty.success ? [] : empty.error.issues.map((issue) => issue.path.join("."));
    expect(paths).toEqual(
      expect.arrayContaining(["state_code", "county", "industries", "location"]),
    );

    const url = newRunSchema.safeParse(
      defaultNewRunValues({ mode: "url", state_code: "FL", county: "Orange", url: "ftp://x" }),
    );
    expect(url.success).toBe(false);

    const good = newRunSchema.safeParse(
      defaultNewRunValues({
        state_code: "FL",
        county: "Orange",
        location: "Orlando, FL",
        industries: ["Construction", "Manufacturing"],
        save_as_scout: true,
        scout_name: "Builders",
      }),
    );
    expect(good.success).toBe(true);
  });

  it("resolves the kind, legs and the batch input", () => {
    const values = defaultNewRunValues({
      state_code: "fl",
      county: "Orange",
      location: "Orlando, FL",
      industries: ["Construction", "Manufacturing", "Wholesale Trade"],
      save_as_scout: true,
      scout_name: "Orange County builders",
    });
    expect(resolvedKind(values)).toBe("location_industry");
    expect(legsOf(values)).toBe(3);
    expect(legLabels(values, 0)).toEqual([
      "Orange County, FL · Construction",
      "Orange County, FL · Manufacturing",
      "Orange County, FL · Wholesale Trade",
    ]);
    const input = toBatchInput(values, []);
    expect(input).toMatchObject({
      kind: "location_industry",
      state_code: "FL",
      location: "Orlando, FL",
      settings: { days: 30, sites: 5, reanalyze: false, memory_mode: "full" },
      save_as_scout: { name: "Orange County builders" },
    });
    expect(legsOf({ ...values, source_mode: "seeds" })).toBe(1);
    expect(resolvedKind({ ...values, source_mode: "seeds" })).toBe("seeds");
  });

  it("pre-fills from a job", () => {
    const job = buildJobFixtures()[0]!;
    const values = valuesFromJob(job);
    expect(values).toMatchObject({
      mode: "location_industry",
      state_code: "FL",
      county: "Orange",
      location: "Orlando, FL",
      industries: ["Construction"],
    });
  });
});
