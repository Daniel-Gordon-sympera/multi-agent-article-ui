import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";
import { db, signInMockUser } from "@/mocks/db";
import { server } from "@/mocks/server";
import { renderApp } from "@/test/render";

describe("website access policies", () => {
  it("lets an operator inspect and reset a learned policy", async () => {
    signInMockUser("operator@sympera.ai");
    const user = userEvent.setup();
    await renderApp({ initialEntries: ["/settings/access-policies"] });
    const table = await screen.findByRole("table", { name: "Website access policies" });
    await within(table).findByText("Bot blocked");
    await user.click(within(table).getByRole("button", { name: "Reset localjournal.example" }));
    const confirm = await screen.findByRole("dialog", {
      name: "Reset access policy for localjournal.example?",
    });
    expect(confirm).toHaveTextContent("does not grant access to restricted content");
    await user.click(within(confirm).getByRole("button", { name: "Reset policy" }));
    await waitFor(() => expect(db.accessPolicies[0]?.active).toBe(false));
    await waitFor(() =>
      expect(
        within(table).getByRole("button", { name: "Reset localjournal.example" }),
      ).toBeDisabled(),
    );
  });

  it("does not request or show the inventory to a viewer", async () => {
    const read = vi.fn(() => HttpResponse.json({ items: [], next_cursor: null }));
    server.use(http.get("/v1/access-policies", read));
    signInMockUser("viewer@sympera.ai");
    await renderApp({ initialEntries: ["/settings/access-policies"] });
    expect(await screen.findByText(/Only operators and admins can view/)).toBeInTheDocument();
    expect(screen.queryByRole("table", { name: "Website access policies" })).toBeNull();
    expect(read).not.toHaveBeenCalled();
  });
});
