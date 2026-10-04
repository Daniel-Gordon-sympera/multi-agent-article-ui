import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { signInMockUser } from "@/mocks/db";
import { JOB_IDS, MAIN_JOB_ID } from "@/mocks/fixtures/jobs";
import { renderApp } from "@/test/render";

const SLOW = 20_000;

describe("/jobs/$jobId/signals", () => {
  it(
    "lists the job's signals with the job-tab columns, the footer and the export link",
    { timeout: SLOW },
    async () => {
      signInMockUser("admin@sympera.ai");
      await renderApp({ initialEntries: [`/jobs/${MAIN_JOB_ID}/signals`] });

      const table = await screen.findByRole("table", { name: "Signals of this job" });
      await waitFor(() => expect(within(table).getAllByRole("row")).toHaveLength(25));
      expect(
        within(table).getByRole("columnheader", { name: "HQ city · scope" }),
      ).toBeInTheDocument();
      expect(within(table).getByRole("columnheader", { name: "Source" })).toBeInTheDocument();
      expect(within(table).queryByRole("columnheader", { name: "Job" })).toBeNull();
      expect(within(table).getAllByText("local").length).toBeGreaterThan(5);

      expect(screen.getByText(/Showing 1–24 of 24 signals/)).toBeInTheDocument();
      expect(
        screen.getByText(/· \d+ companies · HQ city, state and industry come from/),
      ).toBeInTheDocument();
      expect(screen.getByRole("link", { name: /signals\.csv/ })).toHaveAttribute(
        "href",
        `/v1/jobs/${MAIN_JOB_ID}/export/signals.csv`,
      );
      expect(screen.getByLabelText("Job summary")).toHaveTextContent("139 companies · 24 signals");
    },
  );

  it(
    "filters server-side by materiality and client-side by search, then opens the drawer",
    { timeout: SLOW },
    async () => {
      const user = userEvent.setup();
      signInMockUser("viewer@sympera.ai");
      const { router } = await renderApp({ initialEntries: [`/jobs/${MAIN_JOB_ID}/signals`] });
      const table = await screen.findByRole("table", { name: "Signals of this job" });
      await waitFor(() => expect(within(table).getAllByRole("row")).toHaveLength(25));

      await user.click(screen.getByRole("combobox", { name: "Materiality" }));
      await user.click(await screen.findByRole("option", { name: "High" }));
      await waitFor(() => expect(router.state.location.search.materiality).toBe("High"));
      await waitFor(() => expect(within(table).getAllByRole("row").length).toBeLessThan(25));
      expect(within(table).getByText("Lakeview Builders Group")).toBeInTheDocument();
      expect(within(table).queryByText("Mills 50 Partners")).toBeNull();

      await user.type(screen.getByRole("searchbox"), "Osceola{Enter}");
      await waitFor(() => expect(router.state.location.search.q).toBe("Osceola"));
      await waitFor(() => expect(within(table).getAllByRole("row")).toHaveLength(2));
      expect(screen.getByText(/Showing 1–1 signals/)).toBeInTheDocument();

      await user.click(within(table).getByRole("link", { name: "Open signal details" }));
      const drawer = await screen.findByRole("dialog", { name: "Signal details" });
      expect(
        within(drawer).getByRole("heading", { name: "Osceola Steel Fabricators" }),
      ).toBeInTheDocument();
      expect(within(drawer).getByText(/Orange County, FL · Construction · /)).toBeInTheDocument();
      expect(router.state.location.search.detail).toBe(9003);
    },
  );

  it("renders the other jobs' signals too", { timeout: SLOW }, async () => {
    signInMockUser("admin@sympera.ai");
    await renderApp({ initialEntries: [`/jobs/${JOB_IDS.fultonWholesale}/signals`] });
    const table = await screen.findByRole("table", { name: "Signals of this job" });
    await waitFor(() => expect(within(table).getAllByRole("row")).toHaveLength(19));
    expect(within(table).getByText("Peachtree Distribution")).toBeInTheDocument();
  });
});
