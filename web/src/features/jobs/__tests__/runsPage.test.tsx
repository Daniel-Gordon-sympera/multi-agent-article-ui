import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { db, signInMockUser } from "@/mocks/db";
import { JOB_IDS } from "@/mocks/fixtures/jobs";
import { renderApp } from "@/test/render";

async function runsTable() {
  const table = await screen.findByRole("table", { name: "Runs" });
  await waitFor(() => expect(within(table).getAllByRole("row").length).toBeGreaterThan(1));
  return table;
}

describe("/jobs (Runs)", () => {
  it("renders the mockup columns with batch chips, stop reasons and progress facts", async () => {
    signInMockUser("admin@sympera.ai");
    await renderApp({ initialEntries: ["/jobs"] });
    const table = await runsTable();
    const headers = within(table)
      .getAllByRole("columnheader")
      .map((h) => h.textContent?.trim());
    expect(headers.slice(0, 8)).toEqual([
      "Job",
      "Status",
      "Stages",
      "Sites",
      "Articles",
      "Signals",
      "Cost",
      "Started",
    ]);
    expect(
      within(table).getByRole("link", { name: "Orange County, FL · Construction" }),
    ).toHaveAttribute("href", `/jobs/${JOB_IDS.orangeConstruction}`);
    await waitFor(() =>
      expect(
        within(table).getAllByText((_, element) =>
          /^batch \d of 3$/.test(element?.textContent ?? ""),
        ),
      ).toHaveLength(3),
    );
    expect(within(table).getByText("site_time_limit")).toBeInTheDocument();
    expect(within(table).getByText("no_sources_found")).toBeInTheDocument();
    await waitFor(() => expect(within(table).getAllByText("5 / 5").length).toBeGreaterThan(1));
    expect(within(table).getByText("$3.12")).toBeInTheDocument();
    expect(within(table).getByRole("button", { name: "Cancel job 0192f1c2" })).toBeInTheDocument();
    expect(within(table).getByRole("button", { name: "Resume job 0192ee55" })).toBeInTheDocument();
    expect(within(table).getByRole("link", { name: "Run job 0192ea31 again" })).toHaveAttribute(
      "href",
      `/jobs/new?from=${JOB_IDS.fultonWholesale}`,
    );
  });

  it("filters by status through the URL and keeps 'Running' client-side", async () => {
    signInMockUser("viewer@sympera.ai");
    await renderApp({ initialEntries: ["/jobs?status=partial"] });
    const table = await runsTable();
    const rows = within(table).getAllByRole("row").slice(1);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toHaveTextContent("Maricopa County, AZ");
    expect(screen.queryByRole("button", { name: /Cancel job/ })).toBeNull();
  });

  it("lists only running jobs for the synthetic 'running' status and matches the search", async () => {
    signInMockUser("admin@sympera.ai");
    await renderApp({ initialEntries: ["/jobs?status=running&q=orange"] });
    const table = await runsTable();
    const rows = within(table).getAllByRole("row").slice(1);
    expect(rows).toHaveLength(3);
    expect(rows.every((row) => /Orange County/.test(row.textContent ?? ""))).toBe(true);
  });

  it("cancels a run from the row action after confirming", async () => {
    const user = userEvent.setup();
    signInMockUser("operator@sympera.ai");
    await renderApp({ initialEntries: ["/jobs"] });
    const table = await runsTable();
    await user.click(within(table).getByRole("button", { name: "Cancel job 0192f1c2" }));
    const dialog = await screen.findByRole("dialog", { name: "Cancel this run?" });
    await user.click(within(dialog).getByRole("button", { name: "Cancel run" }));
    await waitFor(() =>
      expect(db.jobs.find((j) => j.id === JOB_IDS.orangeConstruction)?.status).toBe("cancelling"),
    );
    await waitFor(() => expect(within(table).getByText("Cancelling")).toBeInTheDocument());
  });

  it("shows the Scout chip and that Scout's runs for ?scout=", async () => {
    signInMockUser("admin@sympera.ai");
    await renderApp({ initialEntries: ["/jobs?scout=a1b2c3d4-0001-4a00-8000-000000000001"] });
    const table = await runsTable();
    expect(await screen.findByText("Runs of Scout Orange County builders")).toBeInTheDocument();
    expect(within(table).getAllByRole("row").slice(1)).toHaveLength(3);
  });
});
