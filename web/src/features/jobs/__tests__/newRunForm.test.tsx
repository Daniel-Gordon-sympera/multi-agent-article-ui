import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { db, signInMockUser } from "@/mocks/db";
import { JOB_IDS, SCOUT_IDS } from "@/mocks/fixtures/jobs";
import { renderApp } from "@/test/render";

async function fillOrangeCounty(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("combobox", { name: "State" }));
  await user.click(await screen.findByRole("option", { name: "Florida (FL)" }));
  await user.type(screen.getByRole("textbox", { name: "County" }), "Orange");
}

async function addIndustry(user: ReturnType<typeof userEvent.setup>, text: string) {
  const input = screen.getByRole("combobox", { name: "Industries" });
  await user.type(input, text);
  await user.keyboard("{Enter}");
}

describe("/jobs/new", () => {
  it("validates inline and never submits an incomplete form", async () => {
    const user = userEvent.setup();
    signInMockUser("operator@sympera.ai");
    await renderApp({ initialEntries: ["/jobs/new"] });
    expect(await screen.findByRole("heading", { level: 1, name: "New run" })).toBeInTheDocument();
    const before = db.jobs.length;
    await user.click(screen.getByRole("button", { name: /Create 1 job/ }));
    const alerts = await screen.findAllByRole("alert");
    expect(alerts.map((a) => a.textContent)).toEqual(
      expect.arrayContaining([
        "Choose a state.",
        "County is required for every job.",
        "Pick at least one industry — each one becomes its own job.",
      ]),
    );
    expect(db.jobs.length).toBe(before);
  });

  it(
    "fans out one job per industry, previews the legs and creates the batch",
    { timeout: 20_000 },
    async () => {
      const user = userEvent.setup();
      signInMockUser("operator@sympera.ai");
      const { router } = await renderApp({ initialEntries: ["/jobs/new?scoutMode=save"] });
      await screen.findByRole("heading", { level: 1, name: "New run" });
      await fillOrangeCounty(user);
      expect(screen.getByRole("textbox", { name: "Location phrase for the finder" })).toHaveValue(
        "Orange County, FL",
      );
      await addIndustry(user, "Cons");
      await addIndustry(user, "Manu");
      await addIndustry(user, "Whol");
      expect(screen.getByText("This will create 3 jobs")).toBeInTheDocument();
      expect(screen.getByText("Orange County, FL · Wholesale Trade")).toBeInTheDocument();
      await waitFor(() =>
        expect(screen.getByText(/3 active sources match Orange County, FL/)).toBeInTheDocument(),
      );
      expect(screen.getByRole("checkbox", { name: "Save as Scout" })).toBeChecked();
      await user.type(
        screen.getByRole("textbox", { name: "Scout name" }),
        "Orange County builders 2",
      );

      const before = db.jobs.length;
      await user.click(screen.getByRole("button", { name: "Create 3 jobs" }));
      await waitFor(() => expect(db.jobs.length).toBe(before + 3));
      const created = db.jobs.slice(0, 3);
      expect(created.map((job) => job.input.industry).sort()).toEqual([
        "Construction",
        "Manufacturing",
        "Wholesale Trade",
      ]);
      expect(created.every((job) => job.client_reference?.startsWith("ui:batch-"))).toBe(true);
      expect(db.scouts.some((scout) => scout.name === "Orange County builders 2")).toBe(true);
      await waitFor(() => expect(router.state.location.pathname).toBe("/jobs"));
    },
  );

  it("pre-fills from a job for Re-run and from a Scout for editing", async () => {
    signInMockUser("admin@sympera.ai");
    const first = await renderApp({
      initialEntries: [`/jobs/new?from=${JOB_IDS.fultonWholesale}`],
    });
    await waitFor(() =>
      expect(screen.getByRole("textbox", { name: "County" })).toHaveValue("Fulton"),
    );
    expect(screen.getByText("Fulton County, GA · Wholesale Trade")).toBeInTheDocument();
    first.unmount();

    await renderApp({ initialEntries: [`/jobs/new?scout=${SCOUT_IDS.orangeBuilders}`] });
    expect(
      await screen.findByRole("heading", { level: 1, name: "Scout · Orange County builders" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Run Scout" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Save changes" })).toBeDisabled();
    expect(screen.getByText("This will create 3 jobs")).toBeInTheDocument();
  });
});
