import { describe, expect, it } from "vitest";
import {
  formatBytes,
  formatCompactNumber,
  formatCountdown,
  formatDate,
  formatDateTime,
  formatDuration,
  formatDurationPrecise,
  formatLocation,
  formatMoney,
  formatRatio,
  formatRelativeTime,
  formatSmartDateTime,
  pluralize,
  shortId,
} from "@/lib/format";

const now = new Date("2026-10-04T11:31:00Z");

describe("format: dates and times", () => {
  it("formats UTC and local date-times (contract §5.3)", () => {
    expect(formatDateTime("2026-10-02T09:30:00Z", { now })).toBe("Oct 2, 09:30 UTC");
    expect(formatDateTime("2025-10-02T09:30:00Z", { now })).toBe("Oct 2, 2025, 09:30 UTC");
    expect(formatDateTime("2026-10-02T09:30:00Z", { now, timeDisplay: "local" })).toBe(
      "Oct 2, 09:30",
    );
    expect(formatDateTime(null)).toBe("—");
  });

  it("uses Today / Yesterday wording for recent instants", () => {
    expect(formatSmartDateTime("2026-10-04T11:02:00Z", { now })).toBe("Today 11:02");
    expect(formatSmartDateTime("2026-10-03T16:10:00Z", { now })).toBe("Yesterday 16:10");
    expect(formatSmartDateTime("2026-10-02T09:30:00Z", { now })).toBe("Oct 2, 09:30");
  });

  it("formats plain dates from YYYY-MM-DD and ISO", () => {
    expect(formatDate("2026-10-02")).toBe("Oct 2, 2026");
    expect(formatDate("2026-10-02T23:59:00Z")).toBe("Oct 2, 2026");
  });

  it("formats relative time and countdowns", () => {
    expect(formatRelativeTime("2026-10-04T11:30:58Z", { now })).toBe("just now");
    expect(formatRelativeTime("2026-10-04T11:30:13Z", { now })).toBe("47 s ago");
    expect(formatRelativeTime("2026-10-04T11:02:00Z", { now })).toBe("29 min ago");
    expect(formatRelativeTime("2026-10-04T08:02:00Z", { now })).toBe("3 h ago");
    expect(formatRelativeTime("2026-10-03T11:02:00Z", { now })).toBe("yesterday");
    expect(formatRelativeTime("2026-10-02T11:02:00Z", { now })).toBe("2 days ago");
    expect(formatCountdown("2026-10-04T11:31:42Z", { now })).toBe("in 42 s");
    expect(formatCountdown("2026-10-04T16:02:00Z", { now })).toBe("in 4 h 31 min");
  });

  it("formats durations", () => {
    expect(formatDuration(38)).toBe("38 s");
    expect(formatDuration(29 * 60)).toBe("29 min");
    expect(formatDuration(72 * 60)).toBe("1 h 12 min");
    expect(formatDuration(5 * 3600)).toBe("5 h");
    expect(formatDuration(null)).toBe("—");
    expect(formatDurationPrecise(131)).toBe("2 m 11 s");
    expect(formatDurationPrecise(1800)).toBe("30 m 00 s");
    expect(formatDurationPrecise(38)).toBe("38 s");
  });
});

describe("format: numbers", () => {
  it("compacts large numbers like the mockup", () => {
    expect(formatCompactNumber(999)).toBe("999");
    expect(formatCompactNumber(26_300)).toBe("26.3K");
    expect(formatCompactNumber(1_640_000)).toBe("1.6M");
    expect(formatCompactNumber(null)).toBe("—");
  });

  it("formats bytes, money and ratios", () => {
    expect(formatBytes(21.4 * 1024 * 1024)).toBe("21.4 MB");
    expect(formatBytes(512)).toBe("512 B");
    expect(formatMoney(3.1234)).toBe("$3.12");
    expect(formatMoney(14.2)).toBe("$14.20");
    expect(formatMoney(3.1, { signed: true })).toBe("+$3.10");
    expect(formatMoney(null)).toBe("—");
    expect(formatRatio(5, 5)).toBe("5 / 5");
    expect(formatRatio(null, null)).toBe("—");
  });

  it("builds ids, locations and plurals", () => {
    expect(shortId("0192f1c2-7e0a-4c1b-9d33-5a1e8b2f0c41")).toBe("0192f1c2");
    expect(formatLocation("Orange", "FL")).toBe("Orange County, FL");
    expect(formatLocation("Orange County", "fl")).toBe("Orange County, FL");
    expect(pluralize(1, "run")).toBe("1 run");
    expect(pluralize(12, "run")).toBe("12 runs");
  });
});
