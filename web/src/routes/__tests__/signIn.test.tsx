import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { db } from "@/mocks/db";
import { renderApp } from "@/test/render";

describe("/sign-in", () => {
  it("rejects wrong credentials without revealing whether the account exists", async () => {
    const user = userEvent.setup();
    await renderApp({ initialEntries: ["/sign-in"] });
    await screen.findByRole("heading", { name: "Sign in" });

    await user.type(screen.getByLabelText("E-mail"), "admin@sympera.ai");
    await user.type(screen.getByLabelText("Password"), "wrong-password");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Incorrect e-mail or password.");
    expect(db.session).toBeNull();
  });

  it("signs in and follows the redirect parameter into the shell", async () => {
    const user = userEvent.setup();
    const { router } = await renderApp({ initialEntries: ["/sign-in?redirect=%2Fsources"] });
    await screen.findByRole("heading", { name: "Sign in" });

    await user.type(screen.getByLabelText("E-mail"), "operator@sympera.ai");
    await user.type(screen.getByLabelText("Password"), "scout-operator");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => expect(router.state.location.pathname).toBe("/sources"));
    expect(
      await screen.findByRole("heading", { level: 1, name: "Data Sources" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Main" })).toBeInTheDocument();
    expect(db.session?.userId).toBe("u-0002-operator");
  });

  it("sends a signed-out visitor of a protected page to /sign-in with the redirect", async () => {
    const { router } = await renderApp({ initialEntries: ["/jobs"] });
    await waitFor(() => expect(router.state.location.pathname).toBe("/sign-in"));
    expect(router.state.location.search).toMatchObject({ redirect: "/jobs" });
    await screen.findByRole("heading", { name: "Sign in" });
  });

  it("forces a password change for accounts flagged must_change_password", async () => {
    const user = userEvent.setup();
    const { router } = await renderApp({ initialEntries: ["/sign-in"] });
    await screen.findByRole("heading", { name: "Sign in" });
    await user.type(screen.getByLabelText("E-mail"), "newcomer@sympera.ai");
    await user.type(screen.getByLabelText("Password"), "scout-newcomer");
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/account/password"));
    expect(
      await screen.findByRole("heading", { name: "Choose a new password" }),
    ).toBeInTheDocument();
  });
});
