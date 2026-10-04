import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { db, signInMockUser } from "@/mocks/db";
import { SCOUT_IDS } from "@/mocks/fixtures/jobs";
import { renderApp } from "@/test/render";
import { lastRunStatus, sourcesLabel } from "./scoutPresentation";

describe("/jobs/scouts", () => {
  it("lists the five Scouts with their sources, last run and actions", async () => {
    signInMockUser("admin@sympera.ai");
    await renderApp({ initialEntries: ["/jobs/scouts"] });

    const table = await screen.findByRole("table", { name: "Scouts" });
    await within(table).findByText("Orange County builders");
    const rows = within(table).getAllByRole("row").slice(1);
    expect(rows).toHaveLength(5);

    const builders = rows[0]!;
    expect(within(builders).getByRole("link", { name: "Orange County builders" })).toHaveAttribute(
      "href",
      `/jobs/new?scout=${SCOUT_IDS.orangeBuilders}`,
    );
    expect(within(builders).getByText("Orange County, FL")).toBeInTheDocument();
    expect(within(builders).getByText("Wholesale Trade")).toBeInTheDocument();
    expect(within(builders).getByText("Finder · top 5 sites")).toBeInTheDocument();
    expect(within(builders).getByText("Manual")).toBeInTheDocument();
    expect(within(builders).getByText("Analysing")).toHaveAttribute("data-tone", "running");
    expect(within(builders).getByText("29 min ago")).toBeInTheDocument();
    expect(within(builders).getByText("7")).toBeInTheDocument();
    expect(within(builders).getByText("24")).toBeInTheDocument();
    expect(
      within(builders).getByRole("button", { name: "Run Scout Orange County builders" }),
    ).toBeInTheDocument();
    expect(
      within(builders).getByRole("link", { name: "Edit Scout Orange County builders" }),
    ).toHaveAttribute("href", `/jobs/new?scout=${SCOUT_IDS.orangeBuilders}`);
    expect(
      within(builders).getByRole("button", {
        name: "More actions for Scout Orange County builders",
      }),
    ).toBeInTheDocument();

    const denver = rows[1]!;
    expect(within(denver).getByText("1 seed from Data Sources")).toBeInTheDocument();
    expect(within(table).getByText("Queued")).toHaveAttribute("data-tone", "neutral");
    expect(screen.getByRole("note")).toHaveTextContent("A Scout is a saved setup");
    const tabs = screen.getByRole("navigation", { name: "Sections" });
    expect(within(tabs).getByRole("link", { name: /Scouts/ })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(within(tabs).getByRole("link", { name: /Scouts/ })).toHaveTextContent("5");
  });

  it("runs a Scout after the confirm dialog and reports the new batch", async () => {
    const user = userEvent.setup();
    signInMockUser("operator@sympera.ai");
    await renderApp({ initialEntries: ["/jobs/scouts"] });
    const jobsBefore = db.jobs.length;

    await user.click(
      await screen.findByRole("button", { name: "Run Scout Orange County builders" }),
    );
    const dialog = await screen.findByRole("dialog", { name: "Run Orange County builders?" });
    expect(dialog).toHaveTextContent("This will create 3 jobs for Orange County builders");
    await user.click(within(dialog).getByRole("button", { name: "Create 3 jobs" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(await screen.findByText("Orange County builders · run 8")).toBeInTheDocument();
    expect(screen.getByText("3 jobs created. They are listed under Runs.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "View runs" })).toBeInTheDocument();
    expect(db.jobs.length).toBe(jobsBefore + 3);
    const batch = db.batches[0]!;
    expect(batch.scout_id).toBe(SCOUT_IDS.orangeBuilders);
    expect(batch.run_number).toBe(8);
    expect(batch.jobs.map((leg) => leg.client_reference)).toEqual([
      `ui:${batch.id}:construction`,
      `ui:${batch.id}:manufacturing`,
      `ui:${batch.id}:wholesale-trade`,
    ]);
    const table = screen.getByRole("table", { name: "Scouts" });
    await waitFor(() => expect(within(table).getAllByText("8")[0]).toBeInTheDocument());
  });

  it("filters by state from the URL and hides actions from viewers", async () => {
    signInMockUser("viewer@sympera.ai");
    await renderApp({ initialEntries: ["/jobs/scouts?state=CO"] });
    const table = await screen.findByRole("table", { name: "Scouts" });
    await within(table).findByText("Denver metro construction");
    expect(within(table).getAllByRole("row").slice(1)).toHaveLength(1);
    expect(screen.queryByRole("button", { name: /Run Scout/ })).toBeNull();
    expect(screen.queryByRole("link", { name: "New Scout" })).toBeNull();
  });

  it("opens the How Scouts work dialog from the banner", async () => {
    const user = userEvent.setup();
    signInMockUser("admin@sympera.ai");
    await renderApp({ initialEntries: ["/jobs/scouts"] });
    await user.click(await screen.findByRole("button", { name: "How Scouts work" }));
    const dialog = await screen.findByRole("dialog", { name: "How Scouts work" });
    expect(dialog).toHaveTextContent("one pipeline job per industry");
    await user.click(within(dialog).getByRole("button", { name: "Got it" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });
});

describe("scout presentation helpers", () => {
  it("aggregates the last run's status and words the sources", () => {
    expect(
      lastRunStatus({
        batch_id: "b",
        run_number: 1,
        created_at: "2026-10-04T11:02:00Z",
        jobs: [
          { job_id: "1", industry: "A", status: "analysing", signals: 1 },
          { job_id: "2", industry: "B", status: "exploring", signals: null },
        ],
      }),
    ).toBe("analysing");
    expect(
      lastRunStatus({
        batch_id: "b",
        run_number: 1,
        created_at: "2026-10-04T11:02:00Z",
        jobs: [
          { job_id: "1", industry: "A", status: "completed", signals: 1 },
          { job_id: "2", industry: "B", status: "failed", signals: null },
        ],
      }),
    ).toBe("partial");
    expect(lastRunStatus(null)).toBeNull();
    const scout = db.scouts.find((s) => s.id === SCOUT_IDS.denverConstruction)!;
    expect(sourcesLabel(scout, undefined)).toBe("seeds from Data Sources");
    expect(sourcesLabel(scout, [])).toBe("0 seeds from Data Sources");
    expect(sourcesLabel({ ...scout, kind: "location_industry", source_mode: "finder" }, [])).toBe(
      "Finder · top 5 sites",
    );
  });
});
