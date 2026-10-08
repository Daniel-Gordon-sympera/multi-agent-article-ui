import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { db, signInMockUser } from "@/mocks/db";
import { renderApp } from "@/test/render";

function searchOf(router: { state: { location: { search: Record<string, unknown> } } }) {
  return router.state.location.search;
}

const SLOW = 20_000;

describe("/signals explorer", () => {
  it(
    "lists signals across jobs with exact summary counts and the materiality strip",
    { timeout: SLOW },
    async () => {
      signInMockUser("admin@sympera.ai");
      await renderApp({ initialEntries: ["/signals"] });

      expect(await screen.findByRole("heading", { level: 1, name: "Signals" })).toBeInTheDocument();
      const table = await screen.findByRole("table", { name: "Signals across jobs" });
      await waitFor(() => expect(within(table).getAllByRole("row").length).toBeGreaterThan(5));
      expect(within(table).getByRole("columnheader", { name: "HQ city" })).toBeInTheDocument();
      expect(
        within(table).getByRole("columnheader", { name: "Job location · source" }),
      ).toBeInTheDocument();
      expect(within(table).queryByRole("columnheader", { name: "Source" })).toBeNull();

      const chips = screen.getByRole("group", { name: "Active filters" });
      await waitFor(() =>
        expect(chips).toHaveTextContent(/\d+ signals · \d+ companies · \d+ jobs/),
      );
      expect(screen.getByLabelText("By materiality")).toHaveTextContent("High");
      expect(screen.getByTestId("top-signal")).toHaveTextContent(/Top signal: .+ \(\d+\)/);
      expect(screen.getByRole("link", { name: /Export CSV/ })).toHaveAttribute(
        "href",
        "/app/signals/export.csv",
      );
    },
  );

  it(
    "round-trips filters through chips: add, remove and clear all",
    { timeout: SLOW },
    async () => {
      const user = userEvent.setup();
      signInMockUser("admin@sympera.ai");
      const { router } = await renderApp({ initialEntries: ["/signals?state=FL&materiality=Low"] });
      await screen.findByRole("table", { name: "Signals across jobs" });

      const chips = screen.getByRole("group", { name: "Active filters" });
      expect(within(chips).getByText("State: FL")).toBeInTheDocument();
      expect(within(chips).getByText("Materiality: Low")).toBeInTheDocument();
      expect(screen.getByRole("link", { name: /Export CSV/ })).toHaveAttribute(
        "href",
        "/app/signals/export.csv?materiality=Low&state=FL",
      );

      await user.click(within(chips).getByRole("button", { name: "Remove filter State: FL" }));
      await waitFor(() => expect(searchOf(router).state).toBeUndefined());
      expect(searchOf(router).materiality).toBe("Low");

      await user.click(screen.getByRole("button", { name: "Add filter" }));
      await user.click(await screen.findByRole("button", { name: "Org kind" }));
      await user.click(screen.getByRole("combobox", { name: "Org kind" }));
      await user.click(await screen.findByRole("option", { name: "gov" }));
      await user.click(screen.getByRole("button", { name: "Apply" }));
      await waitFor(() => expect(searchOf(router).org_kind).toBe("gov"));
      expect(within(chips).getByText("Org kind: gov")).toBeInTheDocument();
      const table = screen.getByRole("table", { name: "Signals across jobs" });
      await waitFor(() => expect(within(table).getAllByRole("row")).toHaveLength(2));
      expect(within(table).getByText("City of Winter Garden")).toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: "Clear all" }));
      await waitFor(() => expect(searchOf(router).org_kind).toBeUndefined());
      expect(searchOf(router).materiality).toBeUndefined();
    },
  );

  it("applies a saved view and saves a new one", { timeout: SLOW }, async () => {
    const user = userEvent.setup();
    signInMockUser("admin@sympera.ai");
    const { router } = await renderApp({ initialEntries: ["/signals"] });
    await screen.findByRole("table", { name: "Signals across jobs" });

    const select = await screen.findByRole("combobox", { name: "Saved view" });
    await waitFor(() => expect(select).toBeEnabled());
    await user.click(select);
    await user.click(await screen.findByRole("option", { name: /Florida construction/ }));
    await waitFor(() => expect(searchOf(router).view).toBe("view-0001"));
    expect(searchOf(router).state).toBe("FL");
    expect(searchOf(router).job_industry).toBe("Construction");
    expect(select).toHaveTextContent("View: Florida construction");

    await user.click(screen.getByRole("button", { name: "Save view" }));
    const dialog = await screen.findByRole("dialog", { name: "Save view" });
    await user.type(within(dialog).getByLabelText("View name"), "FL builders only");
    await user.click(within(dialog).getByRole("button", { name: "Save view" }));
    await waitFor(() => expect(db.views.some((v) => v.name === "FL builders only")).toBe(true));
    const saved = db.views.find((v) => v.name === "FL builders only")!;
    expect(saved.search).toEqual({ state: "FL", job_industry: "Construction" });
    await waitFor(() => expect(searchOf(router).view).toBe(saved.id));
  });
});
