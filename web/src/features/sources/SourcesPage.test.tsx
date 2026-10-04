import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { db, signInMockUser } from "@/mocks/db";
import { server } from "@/mocks/server";
import { renderApp } from "@/test/render";
import { installJsdomBlobMethods } from "./jsdomBlob.test-helper";
import { originLine, relativeDayLabel } from "./sourcePresentation";

installJsdomBlobMethods();

describe("/sources", () => {
  it("renders the tiles, the active sources and the finder suggestions", async () => {
    signInMockUser("admin@sympera.ai");
    await renderApp({ initialEntries: ["/sources"] });

    const table = await screen.findByRole("table", { name: "Data sources" });
    await within(table).findByText("Orlando Magazine");
    expect(within(table).getAllByRole("row").slice(1)).toHaveLength(6);
    const tiles = screen.getByRole("group", { name: "Source statistics" });
    expect(tiles).toHaveTextContent("Active sources23across 5 counties");
    expect(tiles).toHaveTextContent("Promoted from the finder12");
    expect(tiles).toHaveTextContent("Median precision · last run11%");
    expect(tiles).toHaveTextContent("Removed4");

    const orlando = within(table).getAllByRole("row")[1]!;
    expect(within(orlando).getByRole("link", { name: "orlandomagazine.com" })).toHaveAttribute(
      "href",
      "https://orlandomagazine.com",
    );
    expect(within(orlando).getByText("Orange County")).toBeInTheDocument();
    expect(within(orlando).getByText("finder")).toBeInTheDocument();
    expect(within(orlando).getByText(/Promoted .* · rank 1/)).toBeInTheDocument();
    expect(
      within(orlando).getByRole("meter", { name: "Precision of Orlando Magazine" }),
    ).toHaveAttribute("aria-valuenow", "13");
    expect(within(orlando).getByText("18 / 142 candidates")).toBeInTheDocument();
    expect(within(orlando).getByText("Active")).toHaveAttribute("data-tone", "done");
    expect(within(orlando).getByRole("button", { name: "Remove Orlando Magazine" })).toBeVisible();
    expect(
      within(orlando).getByRole("button", { name: "Run a seed job or edit Orlando Magazine" }),
    ).toBeVisible();

    const suggestions = screen.getByRole("region", { name: "Suggested by the finder" });
    expect(within(suggestions).getAllByRole("listitem")).toHaveLength(4);
    expect(within(suggestions).getAllByText("Tier 2").length).toBeGreaterThan(0);
    expect(within(suggestions).getAllByText("Orange County, FL · Construction").length).toBe(2);
    expect(within(suggestions).getByRole("button", { name: "See all 11" })).toBeInTheDocument();
  });

  it("adds a source through the dialog", { timeout: 20_000 }, async () => {
    const user = userEvent.setup();
    signInMockUser("operator@sympera.ai");
    await renderApp({ initialEntries: ["/sources"] });
    await screen.findByText("Orlando Magazine");

    await user.click(screen.getByRole("button", { name: "Add source" }));
    const dialog = await screen.findByRole("dialog", { name: "Add source" });
    await user.click(within(dialog).getByRole("button", { name: "Add source" }));
    expect(await within(dialog).findByText("Give the source a name.")).toBeInTheDocument();

    await user.type(within(dialog).getByLabelText("Name"), "Winter Park Magazine");
    await user.type(within(dialog).getByLabelText("URL"), "www.winterparkmag.com/news");
    await user.type(within(dialog).getByLabelText("County"), "Orange");
    await user.click(within(dialog).getByRole("combobox", { name: "State" }));
    await user.click(await screen.findByRole("option", { name: "Florida (FL)" }));
    await user.type(within(dialog).getByLabelText("Industries"), "Construction{Enter}");
    expect(within(dialog).getByRole("button", { name: "Remove Construction" })).toBeVisible();
    await user.click(within(dialog).getByRole("button", { name: "Add source" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(await screen.findByText("Winter Park Magazine added")).toBeInTheDocument();
    const created = db.sources.find((s) => s.domain === "winterparkmag.com");
    expect(created).toMatchObject({
      county: "Orange",
      state_code: "FL",
      industries: ["Construction"],
      origin: "manual",
    });
    const table = screen.getByRole("table", { name: "Data sources" });
    await within(table).findByText("Winter Park Magazine");
  });

  it("imports a CSV and lists the skipped rows", { timeout: 20_000 }, async () => {
    const user = userEvent.setup();
    signInMockUser("operator@sympera.ai");
    await renderApp({ initialEntries: ["/sources"] });
    await screen.findByText("Orlando Magazine");

    await user.click(screen.getByRole("button", { name: "Import CSV" }));
    const dialog = await screen.findByRole("dialog", { name: "Import sources from CSV" });
    expect(within(dialog).getByRole("link", { name: "Download the CSV template" })).toHaveAttribute(
      "href",
      expect.stringMatching(/^data:text\/csv/),
    );
    const csv = [
      "name,url,county,state,industries",
      "Orlando Magazine,https://orlandomagazine.com,Orange,FL,Construction",
      "Apopka Voice,https://apopkavoice.com,Orange County,Florida,Construction;Manufacturing",
      "Nameless,,Orange,FL,",
    ].join("\n");
    const file = new File([csv], "sources.csv", { type: "text/csv" });
    await user.upload(within(dialog).getByLabelText("CSV file"), file);
    await user.click(within(dialog).getByRole("button", { name: "Import" }));

    const summary = await within(dialog).findByRole("status");
    expect(summary).toHaveTextContent("Imported 1 source, skipped 2.");
    expect(summary).toHaveTextContent("row 2 · already listed for this county and state");
    expect(summary).toHaveTextContent("row 4 · invalid url");
    expect(db.sources.find((s) => s.domain === "apopkavoice.com")).toMatchObject({
      origin: "csv",
      state_code: "FL",
      industries: ["Construction", "Manufacturing"],
    });
    await user.click(within(dialog).getByRole("button", { name: "Done" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("promotes, dismisses and removes", { timeout: 20_000 }, async () => {
    const user = userEvent.setup();
    signInMockUser("operator@sympera.ai");
    await renderApp({ initialEntries: ["/sources"] });
    await screen.findByText("Orlando Magazine");

    await user.click(screen.getByRole("button", { name: "Add orlandoweekly.com to sources" }));
    const dialog = await screen.findByRole("dialog", { name: "Add to sources" });
    expect(within(dialog).getByLabelText("Name")).toHaveValue("Orlando Weekly");
    expect(within(dialog).getByLabelText("URL")).toHaveValue("https://orlandoweekly.com");
    await user.click(within(dialog).getByRole("button", { name: "Add to sources" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(db.sources.find((s) => s.domain === "orlandoweekly.com")).toMatchObject({
      origin: "finder",
      finder: { rank: 4 },
    });
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "Add orlandoweekly.com to sources" })).toBeNull(),
    );

    await user.click(screen.getByRole("button", { name: "Dismiss floridadaily.com" }));
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "Dismiss floridadaily.com" })).toBeNull(),
    );
    expect(db.dismissed.has("floridadaily.com|orange|FL")).toBe(true);

    await user.click(screen.getByRole("button", { name: "Remove GrowthSpotter" }));
    const confirm = await screen.findByRole("dialog", { name: "Remove GrowthSpotter?" });
    await user.click(within(confirm).getByRole("button", { name: "Remove" }));
    await waitFor(() => expect(screen.queryByText("GrowthSpotter")).toBeNull());
    expect(db.sources.find((s) => s.domain === "growthspotter.com")?.status).toBe("removed");
  });

  it("shows the capability note when precision is unavailable and hides controls from viewers", async () => {
    server.use(
      http.get("/app/sources", () =>
        HttpResponse.json({
          items: db.sources
            .filter((s) => s.status === "active")
            .map((s) => ({ ...s, precision: null })),
          stats: { active: 6, promoted: 3, removed: 1, counties: 5, median_precision: null },
        }),
      ),
    );
    signInMockUser("viewer@sympera.ai");
    await renderApp({ initialEntries: ["/sources"] });
    const table = await screen.findByRole("table", { name: "Data sources" });
    await within(table).findByText("Orlando Magazine");
    expect(within(table).getAllByText("needs pipeline API update (B2)")).toHaveLength(6);
    const tiles = screen.getByRole("group", { name: "Source statistics" });
    expect(tiles).toHaveTextContent("Median precision · last run—needs pipeline API update (B2)");
    expect(screen.queryByRole("button", { name: "Add source" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Import CSV" })).toBeNull();
    expect(screen.queryByRole("button", { name: /^Remove / })).toBeNull();
    expect(screen.queryByRole("button", { name: /Add .* to sources/ })).toBeNull();
    expect(screen.getByRole("button", { name: "Export CSV of the listed sources" })).toBeEnabled();
  });
});

describe("source presentation helpers", () => {
  it("words the origin line and relative days", () => {
    const now = new Date("2026-10-04T12:00:00Z");
    expect(relativeDayLabel("2026-10-04T01:00:00Z", now)).toBe("today");
    expect(relativeDayLabel("2026-10-03T23:00:00Z", now)).toBe("yesterday");
    expect(relativeDayLabel("2026-10-02T09:30:00Z", now)).toBe("Oct 2");
    expect(relativeDayLabel(null, now)).toBe("—");
    expect(
      originLine({
        origin: "finder",
        created_at: "2026-09-30T10:00:00Z",
        finder: { tier: "1", verdict: "keep", reason: "", judged_at: null, rank: 1, job_id: null },
      }),
    ).toBe("Promoted Sep 30 · rank 1");
    expect(originLine({ origin: "csv", created_at: "2026-09-20T10:00:00Z", finder: null })).toBe(
      "Imported Sep 20",
    );
  });
});
