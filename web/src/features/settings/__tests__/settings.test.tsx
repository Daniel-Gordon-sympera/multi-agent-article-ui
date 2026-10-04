import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { db, signInMockUser } from "@/mocks/db";
import { SLOW_WORKER_ID } from "@/mocks/fixtures/workers";
import { renderApp } from "@/test/render";
import { LOCAL_KEYS_STORAGE_KEY } from "../keys/localKeys";
import { apiTile, proxyTile, queueTile } from "../workers/workersFormat";

describe("Settings › Workers & health", () => {
  it("maps heartbeats to status pills and highlights the anchored instance", async () => {
    signInMockUser("admin@sympera.ai");
    await renderApp({ initialEntries: [`/settings/workers#${SLOW_WORKER_ID}`] });
    const table = await screen.findByRole("table", { name: "Workers" });
    await within(table).findByText("api-1");
    const slowRow = within(table).getByText(SLOW_WORKER_ID).closest("tr")!;
    expect(within(slowRow).getByText("Slow heartbeat")).toHaveAttribute("data-tone", "warn");
    expect(within(slowRow).getByText(/^4[5-9] s ago$/)).toHaveClass("text-status-warn-fg");
    expect(within(slowRow).getByText("2 tasks")).toBeInTheDocument();
    expect(slowRow).toHaveClass("bg-brand-50");
    const healthyRow = within(table).getByText("finder-1").closest("tr")!;
    expect(within(healthyRow).getByText("Healthy")).toHaveAttribute("data-tone", "done");
    expect(within(healthyRow).getByText("US · ok")).toBeInTheDocument();
    expect(within(table).getAllByRole("row")).toHaveLength(db.workers.length + 1);
    expect(
      within(slowRow).getByRole("button", { name: /Logs · analysis-2 · Not available/ }),
    ).toHaveAttribute("aria-disabled", "true");

    expect(await screen.findByRole("region", { name: "Queue health" })).toHaveTextContent("1 dead");
    expect(screen.getByRole("region", { name: "API health" })).toHaveTextContent("Ready");
    expect(screen.getByRole("region", { name: "Proxy health" })).toHaveTextContent(
      "US exit verified",
    );
    expect(screen.getByRole("region", { name: "Storage health" })).toHaveTextContent(
      "not exposed by the API",
    );
    expect(await screen.findByText("model_rate_limited")).toBeInTheDocument();
    expect(screen.getByText("sweep_jobs")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open dead tasks" })).toHaveAttribute(
      "href",
      "/jobs?status=partial",
    );
  });

  it("builds honest health tiles from partial data", () => {
    expect(apiTile(undefined).status.label).toBe("Loading");
    expect(
      queueTile({
        queued: 0,
        running: 0,
        failed: null,
        dead: 0,
        basis: "recent_jobs",
        jobs_scanned: 2,
      }),
    ).toMatchObject({ status: { tone: "done", label: "No dead tasks" } });
    const proxy = proxyTile(db.workers, new Date());
    expect(proxy.status.label).toBe("US exit verified");
    expect(proxy.rows.find((r) => r.label === "Zone")?.value).toBe("not exposed by the API");
  });
});

describe("Settings › Preferences", () => {
  it("applies the theme immediately and persists it", async () => {
    const user = userEvent.setup();
    signInMockUser("admin@sympera.ai");
    await renderApp({ initialEntries: ["/settings/preferences"] });
    await screen.findByRole("heading", { name: "Preferences" });
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
    await user.click(screen.getByRole("radio", { name: /^Dark/ }));
    await waitFor(() => expect(document.documentElement.getAttribute("data-theme")).toBe("dark"));
    await waitFor(() => expect(db.prefs.get("u-0001-admin")?.theme).toBe("dark"));
    expect(await screen.findByText("Preferences saved")).toBeInTheDocument();
    await user.click(screen.getByRole("radio", { name: /^Compact/ }));
    await waitFor(() =>
      expect(document.documentElement.getAttribute("data-density")).toBe("compact"),
    );
  });
});

describe("Settings › API keys", () => {
  it("creates a key, shows the plaintext once and remembers it locally", async () => {
    const user = userEvent.setup();
    signInMockUser("admin@sympera.ai");
    await renderApp({ initialEntries: ["/settings/keys"] });
    expect(await screen.findByText(/needs pipeline API update \(B4\)/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Create key" }));
    const dialog = await screen.findByRole("dialog", { name: "Create API key" });
    await user.type(within(dialog).getByLabelText("Name"), "bad name!");
    await user.click(within(dialog).getByRole("button", { name: "Create key" }));
    expect(await within(dialog).findByText(/Letters, digits/)).toBeInTheDocument();
    await user.clear(within(dialog).getByLabelText("Name"));
    await user.type(within(dialog).getByLabelText("Name"), "nightly-report");
    await user.click(within(dialog).getByRole("radio", { name: /^operator/ }));
    await user.click(within(dialog).getByRole("button", { name: "Create key" }));

    const created = await screen.findByRole("dialog", { name: "Key created" });
    const secret = within(created).getByLabelText("API key") as HTMLInputElement;
    expect(secret.value).toMatch(/^sympera_operator_/);
    expect(within(created).getByText(/shown exactly once/)).toBeInTheDocument();
    await user.click(within(created).getByRole("button", { name: "I stored it" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

    const table = screen.getByRole("table", { name: "Keys created in this browser" });
    expect(within(table).getByText("nightly-report")).toBeInTheDocument();
    expect(document.body.textContent).not.toContain(secret.value);
    const stored = JSON.parse(window.localStorage.getItem(LOCAL_KEYS_STORAGE_KEY) ?? "[]");
    expect(stored).toEqual([expect.objectContaining({ name: "nightly-report", role: "operator" })]);
    expect(JSON.stringify(stored)).not.toContain(secret.value);
    expect(db.apiKeys.some((k) => k.name === "nightly-report")).toBe(true);

    await user.click(within(table).getByRole("button", { name: "Revoke key nightly-report" }));
    const confirm = await screen.findByRole("dialog", { name: "Revoke key nightly-report?" });
    await user.click(within(confirm).getByRole("button", { name: "Revoke key" }));
    await waitFor(() => expect(db.apiKeys.some((k) => k.name === "nightly-report")).toBe(false));
    await waitFor(() => expect(within(table).queryByText("nightly-report")).toBeNull());
  });

  it("explains the keys to non-admins without any controls", async () => {
    signInMockUser("operator@sympera.ai");
    await renderApp({ initialEntries: ["/settings/keys"] });
    expect(await screen.findByText(/Only admins create or revoke/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Create key" })).toBeNull();
  });
});
