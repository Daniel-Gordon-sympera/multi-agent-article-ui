import { screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { db, signInMockUser } from "@/mocks/db";
import { MAIN_JOB_ID } from "@/mocks/fixtures/jobs";
import { buildAttentionItems, buildOverviewSummary } from "@/mocks/handlers/overview";
import { renderApp } from "@/test/render";
import { formatInteger, formatMoney } from "@/lib/format";
import { groupWorkersByRole } from "../workersGrouping";
import { runningJobsSubLabel, signalsDelta } from "../overviewFormat";

describe("Overview", () => {
  it("renders the four tiles from the /app/overview payload", async () => {
    signInMockUser("admin@sympera.ai");
    await renderApp({ initialEntries: ["/"] });
    const expected = buildOverviewSummary();

    const tiles = await screen.findByRole("region", { name: "Key figures" });
    await waitFor(() =>
      expect(within(tiles).getByText(formatInteger(expected.running_jobs.total))).toBeVisible(),
    );
    expect(within(tiles).getByText(runningJobsSubLabel(expected.running_jobs))).toBeVisible();
    expect(within(tiles).getByText(`across ${expected.running_jobs.scouts} Scouts`)).toBeVisible();
    expect(within(tiles).getByText(formatInteger(expected.signals_7d.count))).toBeVisible();
    expect(within(tiles).getByText(String(signalsDelta(expected.signals_7d).text))).toHaveClass(
      "text-status-done-fg",
    );
    expect(within(tiles).getByText(formatMoney(expected.cost_today.usd))).toBeVisible();
    expect(within(tiles).getByText(String(expected.dead_tasks.count))).toBeVisible();
    expect(within(tiles).getByText("1 new since yesterday")).toHaveClass("text-status-warn-fg");
    expect(within(tiles).getByText("retry from the job's Tasks tab")).toBeVisible();
    expect(screen.getByRole("link", { name: "New run" })).toHaveAttribute("href", "/jobs/new");
    expect(screen.getByRole("button", { name: "Refresh the overview" })).toBeEnabled();
  });

  it("lists the active runs with batch tags and links to the job", async () => {
    signInMockUser("viewer@sympera.ai");
    await renderApp({ initialEntries: ["/"] });
    const table = await screen.findByRole("table", { name: "Active runs" });
    const link = await within(table).findByRole("link", {
      name: "Orange County, FL · Construction",
    });
    expect(link).toHaveAttribute("href", `/jobs/${MAIN_JOB_ID}`);
    expect(await within(table).findByText("batch 2 of 3")).toBeVisible();
    expect(within(table).getAllByRole("row")).toHaveLength(
      db.jobs.filter((j) => !["completed", "partial", "failed", "cancelled"].includes(j.status))
        .length + 1,
    );
    expect(within(table).getByText("$3.12")).toBeVisible();
    expect(screen.getByRole("link", { name: "All jobs" })).toHaveAttribute("href", "/jobs");
    // viewers get no "New run" button
    expect(screen.queryByRole("link", { name: "New run" })).toBeNull();
  });

  it("shows the attention items fail-first with typed links, and the workers by role", async () => {
    signInMockUser("admin@sympera.ai");
    await renderApp({ initialEntries: ["/"] });
    const expected = buildAttentionItems();
    const list = await screen.findByRole("list", { name: "Attention items" });
    const items = within(list).getAllByRole("listitem");
    expect(items).toHaveLength(expected.length);
    expect(expected.map((i) => i.severity)).toEqual([
      ...expected.filter((i) => i.severity === "fail").map(() => "fail"),
      ...expected.filter((i) => i.severity === "warn").map(() => "warn"),
    ]);
    expect(
      within(list).getByRole("link", { name: /1 dead task · analyze_article/ }),
    ).toHaveAttribute("href", `/jobs/${MAIN_JOB_ID}/tasks`);
    expect(
      within(list).getByRole("link", { name: /analysis-2 heartbeat is slow/ }),
    ).toHaveAttribute("href", "/settings/workers#analysis-2");
    expect(within(list).getByRole("link", { name: /Partial run waiting/ })).toHaveAttribute(
      "href",
      expect.stringMatching(/^\/jobs\/0192ee55/),
    );
    expect(screen.getByRole("heading", { name: "Needs attention" })).toBeVisible();
    expect(screen.getByText(`${expected.length} items`)).toBeVisible();

    const workers = await screen.findByRole("list", { name: "Workers by role" });
    const rows = groupWorkersByRole(db.workers, new Date());
    expect(within(workers).getAllByRole("listitem")).toHaveLength(rows.length);
    const analysis = within(workers).getByText("analysis").closest("li")!;
    expect(within(analysis).getByText("slow heartbeat")).toBeInTheDocument();
    expect(within(analysis).getByText("2 instances")).toBeVisible();
    expect(screen.getByText(/8 instances · proxy exit US verified/)).toBeVisible();
    expect(screen.getByRole("link", { name: "Details" })).toHaveAttribute(
      "href",
      "/settings/workers",
    );
  });

  it("renders the recent signals as drawer links", async () => {
    signInMockUser("admin@sympera.ai");
    await renderApp({ initialEntries: ["/"] });
    const list = await screen.findByRole("list", { name: "Recent signals" });
    const links = within(list).getAllByRole("link");
    expect(links).toHaveLength(5);
    expect(links[0]).toHaveAttribute(
      "href",
      expect.stringMatching(/^\/signals\?detail=\d+&detail_job=/),
    );
    expect(screen.getByRole("link", { name: "Open explorer" })).toHaveAttribute("href", "/signals");
  });
});
