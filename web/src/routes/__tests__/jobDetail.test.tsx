import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { db, signInMockUser } from "@/mocks/db";
import { MAIN_JOB_ID } from "@/mocks/fixtures/jobs";
import { renderApp } from "@/test/render";

describe("/jobs/$jobId layout", () => {
  it("renders the job header, meta line, tabs and the summary strip on a results tab", async () => {
    signInMockUser("admin@sympera.ai");
    await renderApp({ initialEntries: [`/jobs/${MAIN_JOB_ID}/signals`] });

    expect(
      await screen.findByRole("heading", { level: 1, name: "Orange County, FL · Construction" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Analysing", { selector: "[data-tone]" })).toHaveAttribute(
      "data-tone",
      "running",
    );
    expect(screen.getByText(MAIN_JOB_ID)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copy job id" })).toBeInTheDocument();
    expect(screen.getByText("location_industry")).toBeInTheDocument();
    expect(screen.getByText("2026.10")).toBeInTheDocument();
    expect(screen.getByText("daniel-ops", { selector: "strong" })).toBeInTheDocument();
    expect(await screen.findByText("batch 1 of 3")).toBeInTheDocument();
    expect(screen.getByText("Orange County builders")).toBeInTheDocument();

    const breadcrumb = screen.getByRole("navigation", { name: "Breadcrumb" });
    expect(within(breadcrumb).getByText("0192f1c2")).toBeInTheDocument();

    const tabs = screen.getByRole("navigation", { name: "Sections" });
    expect(within(tabs).getByRole("link", { name: /Signals/ })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(within(tabs).getByRole("link", { name: /Companies/ })).toHaveTextContent("139");
    expect(within(tabs).getByRole("link", { name: /Site runs/ })).toBeInTheDocument();

    const strip = screen.getByLabelText("Job summary");
    expect(strip).toHaveTextContent("31 / 40 summaries");
    expect(strip).toHaveTextContent("139 companies · 24 signals");
    expect(strip).toHaveTextContent("$3.12");

    expect(screen.getByRole("button", { name: "Cancel run" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Resume" })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Export CSV/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "More actions" })).toBeInTheDocument();
  });

  it("lists the eleven CSV tables in the export menu", async () => {
    const user = userEvent.setup();
    signInMockUser("viewer@sympera.ai");
    await renderApp({ initialEntries: [`/jobs/${MAIN_JOB_ID}`] });
    await screen.findByRole("heading", { level: 1, name: "Orange County, FL · Construction" });
    expect(screen.queryByRole("button", { name: "Cancel run" })).toBeNull();

    await user.click(screen.getByRole("button", { name: /Export CSV/ }));
    const menu = await screen.findByRole("menu");
    const links = within(menu).getAllByRole("menuitem");
    expect(links).toHaveLength(11);
    expect(links[0]).toHaveAttribute("href", `/v1/jobs/${MAIN_JOB_ID}/export/sources.csv`);
    expect(links[10]).toHaveAttribute("href", `/v1/jobs/${MAIN_JOB_ID}/export/company_flags.csv`);
  });

  it("cancels the run through the confirm dialog and flips the status pill", async () => {
    const user = userEvent.setup();
    signInMockUser("operator@sympera.ai");
    await renderApp({ initialEntries: [`/jobs/${MAIN_JOB_ID}`] });
    await screen.findByRole("heading", { level: 1, name: "Orange County, FL · Construction" });

    await user.click(screen.getByRole("button", { name: "Cancel run" }));
    const dialog = await screen.findByRole("dialog", { name: "Cancel this run?" });
    await user.click(within(dialog).getByRole("button", { name: "Cancel run" }));

    await waitFor(() =>
      expect(screen.getByText("Cancelling")).toHaveAttribute("data-tone", "neutral"),
    );
    expect(db.jobs.find((j) => j.id === MAIN_JOB_ID)?.status).toBe("cancelling");
    await waitFor(() => expect(screen.getByRole("button", { name: "Cancel run" })).toBeDisabled());
  });

  it("shows an error state for an unknown job", async () => {
    signInMockUser("admin@sympera.ai");
    await renderApp({ initialEntries: ["/jobs/ffffffff-0000-4000-8000-000000000000"] });
    expect(await screen.findByRole("alert")).toHaveTextContent("This job could not be loaded");
  });
});
