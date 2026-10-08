import { describe, expect, it } from "vitest";
import { buildSignalColumns } from "@/features/signals/signalCells";
import {
  SIGNAL_COLUMN_IDS,
  defaultVisibleColumns,
  isSignalColumnId,
} from "@/features/signals/signalColumns";
import { activeChips, dateChipLabel, isoDateDaysAgo } from "@/features/signals/signalFilters";
import { signalKeyForTitle, signalTitle } from "@/features/signals/signalCatalog";
import { signalRowsToCsv } from "@/features/signals/signalExport";
import { buildSignalFixtures } from "@/mocks/fixtures/signals";

describe("signal column registry", () => {
  it("shows the job-tab columns by default on the job route", () => {
    expect(defaultVisibleColumns("job")).toEqual([
      "record",
      "hqCity",
      "hqState",
      "industry",
      "revenueBin",
      "date",
      "source",
      "open",
    ]);
  });

  it("shows the explorer columns (job location + job, no source) on the explorer route", () => {
    expect(defaultVisibleColumns("explorer")).toEqual([
      "record",
      "hqCity",
      "hqState",
      "industry",
      "revenueBin",
      "date",
      "jobLocation",
      "job",
      "open",
    ]);
  });

  it("builds one TanStack column per registry entry with the route's default visibility", () => {
    for (const route of ["job", "explorer"] as const) {
      const columns = buildSignalColumns(route);
      expect(columns.map((c) => c.id)).toEqual([...SIGNAL_COLUMN_IDS]);
      const hidden = columns.filter((c) => c.meta?.defaultHidden).map((c) => c.id);
      const visible = SIGNAL_COLUMN_IDS.filter((id) => !hidden.includes(id));
      expect(visible).toEqual(defaultVisibleColumns(route));
      expect(columns.find((c) => c.id === "record")?.enableHiding).toBe(false);
      expect(columns.find((c) => c.id === "open")?.enableHiding).toBe(false);
    }
    expect(buildSignalColumns("job").find((c) => c.id === "hqCity")?.header).toBe(
      "HQ city · scope",
    );
    expect(buildSignalColumns("explorer").find((c) => c.id === "hqCity")?.header).toBe("HQ city");
    expect(isSignalColumnId("hqCity")).toBe(true);
    expect(isSignalColumnId("nope")).toBe(false);
  });
});

describe("signal catalog", () => {
  it("maps titles to catalog keys and back", () => {
    expect(signalKeyForTitle("Major Contract Awarded")).toBe("Major_Contract_Award");
    expect(signalTitle("Mass_Hiring")).toBe("Mass Hiring");
    expect(signalTitle("Something_New")).toBe("Something New");
    expect(signalTitle(null)).toBe("—");
  });

  it("gives every fixture row a catalog key and the drawn title", () => {
    const rows = buildSignalFixtures();
    const lakeview = rows.find((r) => r.company === "Lakeview Builders Group");
    expect(lakeview?.signal).toBe("Major_Contract_Award");
    expect(lakeview?.signal_title).toBe("Major Contract Awarded");
    expect(rows).toHaveLength(29);
  });
});

describe("filter chips and CSV fields", () => {
  it("renders one chip per active filter with the date range merged", () => {
    const now = new Date("2026-10-04T12:00:00Z");
    const chips = activeChips(
      {
        state: "FL",
        materiality: "High",
        signal: "Mass_Hiring",
        date_after: isoDateDaysAgo(7, now),
      },
      now,
    );
    expect(chips.map((c) => c.label)).toEqual([
      "Date: last 7 days",
      "State: FL",
      "Signal: Mass Hiring",
      "Materiality: High",
    ]);
    expect(chips[0]?.clears).toEqual(["date_after", "date_before"]);
    expect(dateChipLabel("2026-10-01", "2026-10-04", now)).toBe("Date: Oct 1 – Oct 4");
    expect(dateChipLabel(undefined, "2026-10-04", now)).toBe("Date: until Oct 4");
  });

  it("exports the pipeline columns plus the job columns", () => {
    const csv = signalRowsToCsv([{ ...buildSignalFixtures()[0]!, job_id: "j1", county: "Orange" }]);
    const [header, line] = csv.split("\r\n");
    expect(header?.startsWith("id,summary_id,article_id,")).toBe(true);
    expect(header?.endsWith(",job_id,county,state,job_industry")).toBe(true);
    expect(line?.endsWith(",j1,Orange,,")).toBe(true);
  });
});
