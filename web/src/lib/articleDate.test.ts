import { describe, expect, it } from "vitest";
import { formatArticleDate } from "./articleDate";

describe("article date precision", () => {
  it("does not invent a day for a month or unknown publication date", () => {
    expect(formatArticleDate("2026-09-01", "month")).toBe("Sep 2026");
    expect(formatArticleDate("2026-09")).toBe("Sep 2026");
    expect(formatArticleDate("2026-09-01", "unknown")).toBe("—");
    expect(formatArticleDate(null)).toBe("—");
    expect(formatArticleDate("2026-09-14", "day")).toContain("14");
  });
});
