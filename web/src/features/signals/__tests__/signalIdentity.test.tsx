import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { db, signInMockUser } from "@/mocks/db";
import { MAIN_JOB_ID } from "@/mocks/fixtures/jobs";
import { crossJobRow } from "@/mocks/handlers/signalsDetail";
import { server } from "@/mocks/server";
import { renderApp } from "@/test/render";

describe("signal identity across jobs", () => {
  it("keeps two reused mentions distinct and opens the selected job", async () => {
    signInMockUser("admin@sympera.ai");
    const otherJob = db.jobs.find((job) => job.id !== MAIN_JOB_ID)!;
    const base = crossJobRow(db.signals[0]!);
    const other = { ...base, job_id: otherJob.id, company: "Repeated mention in another run" };
    server.use(
      http.get("/app/signals", () =>
        HttpResponse.json({ items: [base, other], next_cursor: null }),
      ),
    );
    const user = userEvent.setup();
    const { router } = await renderApp({ initialEntries: ["/signals"] });
    const table = await screen.findByRole("table", { name: "Signals across jobs" });
    const link = await within(table).findByRole("link", { name: other.company });
    expect(within(table).getAllByRole("row")).toHaveLength(3);
    expect(link).toHaveAttribute("href", expect.stringContaining(`detail_job=${otherJob.id}`));
    await user.click(link);
    const drawer = await screen.findByRole("dialog", { name: "Signal details" });
    expect(await within(drawer).findByRole("heading", { name: other.company })).toBeInTheDocument();
    expect(router.state.location.search.detail_job).toBe(otherJob.id);
    expect(router.state.location.search.detail).toBe(base.id);
  });

  it("loads a copied off-page link by exact job and mention and uses job state for the profile", async () => {
    signInMockUser("admin@sympera.ai");
    const row = { ...db.signals[0]!, hq_state: "NY" };
    const calls: string[] = [];
    const profiles: URL[] = [];
    server.use(
      http.get("/app/signals", () => HttpResponse.json({ items: [], next_cursor: null })),
      http.get(`/v1/jobs/${MAIN_JOB_ID}/signals`, ({ request }) => {
        calls.push(request.url);
        return HttpResponse.json({ items: [row], next_cursor: null });
      }),
      http.get("/v1/companies/:key", ({ request }) => {
        profiles.push(new URL(request.url));
        return HttpResponse.json({
          company_key: row.company_key,
          name: row.company ?? row.name_as_written,
          mentions: { items: [{ ...row, published_date: "2026-09-22" }], next_cursor: null },
          signals: { items: [], next_cursor: null },
        });
      }),
    );
    await renderApp({ initialEntries: [`/signals?detail=${row.id}&detail_job=${MAIN_JOB_ID}`] });
    const drawer = await screen.findByRole("dialog", { name: "Signal details" });
    expect(
      await within(drawer).findByRole("heading", { name: row.company ?? row.name_as_written }),
    ).toBeInTheDocument();
    expect(calls.some((url) => new URL(url).searchParams.get("id") === String(row.id))).toBe(true);
    await waitFor(() =>
      expect(
        profiles.some(
          (url) =>
            url.searchParams.get("state") === "FL" &&
            url.searchParams.get("job_id") === MAIN_JOB_ID,
        ),
      ).toBe(true),
    );
    expect(profiles.some((url) => url.searchParams.get("state") === "NY")).toBe(false);
  });
});
