import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { db, signInMockUser } from "@/mocks/db";
import { MAIN_JOB_ID } from "@/mocks/fixtures/jobs";
import { renderApp } from "@/test/render";

const TASKS_URL = `/jobs/${MAIN_JOB_ID}/tasks`;

async function tasksTable() {
  const table = await screen.findByRole("table", { name: "Tasks of this job" });
  await waitFor(() => expect(within(table).getAllByRole("row").length).toBeGreaterThan(5));
  return table;
}

describe("/jobs/$jobId/tasks", () => {
  it("renders the tree, the status chips and the note banner", async () => {
    signInMockUser("viewer@sympera.ai");
    await renderApp({ initialEntries: [TASKS_URL] });
    const table = await tasksTable();
    const rows = within(table).getAllByRole("row").slice(1);
    expect(rows).toHaveLength(12);
    expect(rows[0]).toHaveTextContent("find_sources");
    expect(rows[1]).toHaveTextContent("rank_sites");
    expect(rows[11]).toHaveTextContent("finalize_job");
    const chips = screen.getByRole("group", { name: "Task status counts" });
    expect(within(chips).getByRole("button", { name: /dead/ })).toHaveTextContent("dead1");
    expect(within(chips).getByRole("button", { name: /failed · retrying/ })).toHaveTextContent("1");
    expect(within(table).getByText(/Retry in \d+ s/)).toBeInTheDocument();
    expect(screen.getByRole("note")).toHaveTextContent(
      "Dead tasks stop retrying after max attempts",
    );
    expect(screen.queryByRole("button", { name: "Retry all dead" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Retry task 48920" })).toBeNull();
  });

  it("switches to the flat layout and filters by status through the chips", async () => {
    const user = userEvent.setup();
    signInMockUser("viewer@sympera.ai");
    const { router } = await renderApp({ initialEntries: [TASKS_URL] });
    await tasksTable();
    await user.click(screen.getByRole("checkbox", { name: "Show as tree" }));
    await waitFor(() => expect(router.state.location.search).toMatchObject({ layout: "flat" }));
    await user.click(screen.getByRole("button", { name: /succeeded/ }));
    await waitFor(() =>
      expect(router.state.location.search).toMatchObject({ status: "succeeded" }),
    );
    const table = await screen.findByRole("table", { name: "Tasks of this job" });
    await waitFor(() => expect(within(table).getAllByRole("row").slice(1)).toHaveLength(8));
  });

  it("retries one dead task and then all dead tasks as an operator", async () => {
    const user = userEvent.setup();
    signInMockUser("operator@sympera.ai");
    // Two dead tasks: one is retried from its row, the other through "Retry all dead".
    const second = db.tasks.find((t) => t.id === 48915)!;
    second.status = "dead";
    second.attempts = 4;
    await renderApp({ initialEntries: [TASKS_URL] });
    const table = await tasksTable();
    await user.click(within(table).getByRole("button", { name: "Retry task 48920" }));
    await waitFor(() => expect(db.tasks.find((t) => t.id === 48920)?.status).toBe("queued"));
    expect(await screen.findByText("Task #48920 re-queued")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Retry all dead" }));
    await waitFor(() => expect(db.tasks.filter((t) => t.status === "dead")).toHaveLength(0));
    expect(await screen.findByText("1 dead task re-queued")).toBeInTheDocument();
    expect(db.jobs.find((j) => j.id === MAIN_JOB_ID)?.progress.tasks_dead).toBe(0);
  });

  it("opens the task details dialog from the URL", async () => {
    signInMockUser("admin@sympera.ai");
    await renderApp({ initialEntries: [`${TASKS_URL}?task=48920`] });
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent("analyze_article");
    expect(dialog).toHaveTextContent("saved_content_unavailable");
    expect(within(dialog).getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });
});
