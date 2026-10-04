import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { signInMockUser } from "@/mocks/db";
import { MAIN_JOB_ID } from "@/mocks/fixtures/jobs";
import { renderApp } from "@/test/render";

const LAKEVIEW_ID = 9000;

const SLOW = 20_000;

describe("signal drawer", () => {
  it(
    "renders the evidence, article, company profile and job from the fixtures",
    { timeout: SLOW },
    async () => {
      signInMockUser("admin@sympera.ai");
      await renderApp({ initialEntries: [`/signals?detail=${LAKEVIEW_ID}`] });

      const drawer = await screen.findByRole("dialog", { name: "Signal details" });
      expect(
        await within(drawer).findByRole("heading", { name: "Lakeview Builders Group" }),
      ).toBeInTheDocument();
      expect(within(drawer).getByText("Major Contract Awarded")).toBeInTheDocument();
      expect(within(drawer).getByText("High")).toHaveAttribute("data-materiality", "high");
      expect(within(drawer).getByText(/Orange County, FL · Construction · /)).toBeInTheDocument();

      const quote = within(drawer).getByRole("blockquote");
      expect(quote).toHaveTextContent(
        "Lakeview Builders Group was awarded the $42 million contract",
      );
      expect(within(drawer).getByText("quote #3")).toBeInTheDocument();
      expect(within(drawer).getByText("verbatim match")).toBeInTheDocument();
      expect(within(drawer).getByText("name grounded")).toBeInTheDocument();
      expect(within(drawer).getByText("role: subject")).toBeInTheDocument();
      expect(within(drawer).getByText("0.92 · high")).toBeInTheDocument();

      expect(
        within(drawer).getByRole("link", {
          name: "Kirkman Road logistics hub clears final approval",
        }),
      ).toHaveAttribute("href", expect.stringContaining("orlandomagazine.com"));
      expect(
        await within(drawer).findByText(/Orange County commissioners approved/),
      ).toBeInTheDocument();
      expect(within(drawer).getByText(/article #71334/)).toBeInTheDocument();

      expect(within(drawer).getByText("business · name cue")).toBeInTheDocument();
      expect(within(drawer).getByText("local · Orange County, FL")).toBeInTheDocument();
      expect(
        within(drawer).getByText("Construction · Nonresidential building (2362)"),
      ).toBeInTheDocument();
      expect(within(drawer).getByText("$10M-$20M · explicit figure")).toBeInTheDocument();
      const across = await within(drawer).findByTestId("across-jobs");
      await waitFor(() =>
        expect(across).toHaveTextContent(/\d+ mentions? in \d+ jobs? · \d+ signals?/),
      );

      expect(
        within(drawer).getByRole("link", { name: "Orange County, FL · Construction" }),
      ).toHaveAttribute("href", `/jobs/${MAIN_JOB_ID}`);
      await waitFor(() => expect(within(drawer).getByText("Analysing")).toBeInTheDocument());
      expect(within(drawer).getByRole("button", { name: "Copy link" })).toBeInTheDocument();
      expect(within(drawer).getByRole("button", { name: "Export row" })).toBeInTheDocument();
    },
  );

  it("steps to the next signal and closes back to the list", { timeout: SLOW }, async () => {
    const user = userEvent.setup();
    signInMockUser("viewer@sympera.ai");
    const { router } = await renderApp({ initialEntries: [`/signals?detail=${LAKEVIEW_ID}`] });
    const drawer = await screen.findByRole("dialog", { name: "Signal details" });
    await within(drawer).findByRole("heading", { name: "Lakeview Builders Group" });

    await user.click(within(drawer).getByRole("button", { name: "Next" }));
    await waitFor(() => expect(router.state.location.search.detail).not.toBe(LAKEVIEW_ID));
    expect(within(drawer).queryByRole("heading", { name: "Lakeview Builders Group" })).toBeNull();

    await user.click(within(drawer).getByRole("button", { name: "Close details" }));
    await waitFor(() => expect(router.state.location.search.detail).toBeUndefined());
  });

  it("shows the expired note for a purged saved text", { timeout: SLOW }, async () => {
    const user = userEvent.setup();
    signInMockUser("admin@sympera.ai");
    await renderApp({ initialEntries: [`/jobs/${MAIN_JOB_ID}/signals?detail=9007`] });
    const drawer = await screen.findByRole("dialog", { name: "Signal details" });
    await within(drawer).findByRole("heading", { name: "Sunshine Roofing Co." });
    await user.click(within(drawer).getByRole("button", { name: "Saved text" }));
    const dialog = await screen.findByRole("dialog", { name: "Saved text" });
    expect(await within(dialog).findByRole("note")).toHaveTextContent("has expired (410)");
  });
});
