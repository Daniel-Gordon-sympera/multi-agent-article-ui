import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const MAIN_JOB_ID = "0192f1c2-7e0a-4c1b-9d33-5a1e8b2f0c41";

async function signIn(page: Page, email = "admin@sympera.ai", password = "scout-admin") {
  await page.goto("/sign-in");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("navigation", { name: "Main" })).toBeVisible();
}

async function expectAccessible(page: Page, label: string) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "best-practice"])
    .analyze();
  const serious = results.violations.filter(
    (v) => v.impact === "serious" || v.impact === "critical",
  );
  const summary = serious
    .map((v) => `${v.id}: ${v.help} (${v.nodes.map((n) => n.target.join(" ")).join("; ")})`)
    .join("\n");
  expect(serious, `${label} has accessibility violations:\n${summary}`).toEqual([]);
}

function trackConsole(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error" && !/Failed to load resource/.test(message.text())) {
      errors.push(message.text());
    }
  });
  page.on("pageerror", (error) => errors.push(error.message));
  return errors;
}

test.describe("Overview (mock mode)", () => {
  test("renders the tiles, the cards and their links in both themes", async ({ page }) => {
    const errors = trackConsole(page);
    await signIn(page);
    await expect(page.getByRole("heading", { level: 1, name: "Overview" })).toBeVisible();

    const tiles = page.getByRole("region", { name: "Key figures" });
    await expect(tiles).toContainText("Running jobs");
    await expect(tiles).toContainText("across 3 Scouts");
    await expect(tiles).toContainText("Signals · last 7 days");
    await expect(tiles).toContainText("vs previous 7 days");
    await expect(tiles).toContainText("Model + proxy cost · today");
    await expect(tiles).toContainText("vs yesterday");
    await expect(tiles).toContainText("Dead tasks");
    await expect(tiles).toContainText("retry from the job's Tasks tab");

    const runs = page.getByRole("table", { name: "Active runs" });
    await expect(
      runs.getByRole("link", { name: "Orange County, FL · Construction" }),
    ).toHaveAttribute("href", `/jobs/${MAIN_JOB_ID}`);
    await expect(runs.getByText("batch 1 of 3")).toBeVisible();
    await expect(page.getByRole("link", { name: "All jobs" })).toHaveAttribute("href", "/jobs");

    const attention = page.getByRole("list", { name: "Attention items" });
    await expect(attention.getByRole("link", { name: /1 dead task/ })).toHaveAttribute(
      "href",
      `/jobs/${MAIN_JOB_ID}/tasks`,
    );
    await expect(
      attention.getByRole("link", { name: /analysis-2 heartbeat is slow/ }),
    ).toHaveAttribute("href", "/settings/workers#analysis-2");
    await expect(page.getByRole("list", { name: "Recent signals" }).getByRole("link")).toHaveCount(
      5,
    );
    await expect(page.getByRole("list", { name: "Workers by role" })).toContainText("analysis");
    await expect(page.getByText(/8 instances · proxy exit US verified/)).toBeVisible();

    await page.getByRole("button", { name: "Refresh the overview" }).click();
    await expect(tiles).toContainText("Running jobs");
    await expectAccessible(page, "overview (light)");

    await page.emulateMedia({ colorScheme: "dark" });
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await expectAccessible(page, "overview (dark)");
    await page.emulateMedia({ colorScheme: "light" });

    await page.getByRole("link", { name: "View all" }).click();
    await expect(page).toHaveURL(/\/settings\/workers$/);
    expect(errors).toEqual([]);
  });

  test("follows a worker attention item to the highlighted row", async ({ page }) => {
    await signIn(page);
    await page.getByRole("link", { name: /analysis-2 heartbeat is slow/ }).click();
    await expect(page).toHaveURL(/\/settings\/workers#analysis-2$/);
    const row = page
      .getByRole("table", { name: "Workers" })
      .getByRole("row", { name: /analysis-2/ });
    await expect(row).toHaveClass(/bg-brand-50/);
    await expect(row.getByText("Slow heartbeat")).toBeVisible();
  });
});

test.describe("Settings (mock mode)", () => {
  test("every tab renders and passes axe", async ({ page }) => {
    const errors = trackConsole(page);
    await signIn(page);

    await page.goto("/settings/workers");
    await expect(page.getByRole("region", { name: "Queue health" })).toContainText("1 dead");
    await expect(page.getByRole("table", { name: "Workers" }).getByRole("row")).toHaveCount(9);
    await expect(page.getByText("model_rate_limited")).toBeVisible();
    await expect(page.getByText("backup_database")).toBeVisible();
    await expectAccessible(page, "settings workers");

    await page.goto("/settings/stats");
    const stats = page.getByRole("table", { name: "Daily stats" });
    await expect(stats.getByRole("row")).toHaveCount(15);
    await expect(page.getByText("Jobs · last 14 days")).toBeVisible();
    await expect(page.getByRole("button", { name: "Load more" })).toBeDisabled();
    await expect(page.getByText("incomplete")).toBeVisible();
    await expectAccessible(page, "settings stats");

    await page.goto("/settings/exports");
    await expect(page.getByRole("heading", { name: "Dataset export" })).toBeVisible();
    await expect(
      page.getByRole("table", { name: "Exports started from this browser" }),
    ).toBeVisible();
    await expectAccessible(page, "settings exports");

    await page.goto("/settings/system");
    await expect(page.getByText("Scout BFF")).toBeVisible();
    await expect(page.getByRole("table", { name: "Capabilities" }).getByRole("row")).toHaveCount(9);
    await expect(page.getByText("Model prices are not exposed", { exact: false })).toBeVisible();
    await expectAccessible(page, "settings system");

    await page.goto("/settings/preferences");
    await expect(page.getByRole("radio", { name: /^System/ })).toBeChecked();
    await expectAccessible(page, "settings preferences");

    await page.goto("/settings/keys");
    await expect(page.getByText(/needs pipeline API update \(B4\)/)).toBeVisible();
    await expectAccessible(page, "settings keys");

    await page.goto("/settings/users");
    await expect(page.getByRole("table", { name: "Users" }).getByRole("row")).toHaveCount(5);
    await expectAccessible(page, "settings users");
    expect(errors).toEqual([]);
  });

  test("creates an API key, shows it once and revokes it", async ({ page }) => {
    await signIn(page);
    await page.goto("/settings/keys");
    await page.getByRole("button", { name: "Create key" }).click();
    const dialog = page.getByRole("dialog", { name: "Create API key" });
    await dialog.getByLabel("Name").fill("e2e-reader");
    await dialog.getByRole("button", { name: "Create key" }).click();
    const created = page.getByRole("dialog", { name: "Key created" });
    await expect(created.getByText("Store it now", { exact: false })).toBeVisible();
    const secret = await created.getByRole("textbox", { name: "API key" }).inputValue();
    expect(secret).toMatch(/^sympera_reader_/);
    await created.getByRole("button", { name: "I stored it" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    const table = page.getByRole("table", { name: "Keys created in this browser" });
    await expect(table.getByText("e2e-reader")).toBeVisible();
    await expect(page.locator("body")).not.toContainText(secret);
    await page.getByRole("button", { name: "Revoke key e2e-reader" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Revoke key" }).click();
    await expect(table.getByText("e2e-reader")).toHaveCount(0);
  });

  test("switches the theme to dark from Preferences", async ({ page }) => {
    await signIn(page);
    await page.goto("/settings/preferences");
    await page.getByRole("radio", { name: /^Dark/ }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await expect(page.getByText("Preferences saved").first()).toBeVisible();
    await expectAccessible(page, "preferences (dark)");
    // persistence across reloads is covered by the Vitest suite (the mock db forgets on reload)
    await page.getByRole("radio", { name: /^Light/ }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  });

  test("an admin creates a user who must change the password", async ({ page }) => {
    await signIn(page);
    await page.goto("/settings/users");
    await page.getByRole("button", { name: "Create user" }).click();
    const dialog = page.getByRole("dialog", { name: "Create user" });
    await dialog.getByLabel("E-mail").fill("carol@sympera.ai");
    await dialog.getByLabel("Name").fill("Carol");
    await dialog.getByLabel("Temporary password").fill("carol-temporary-1");
    await dialog.getByRole("button", { name: "Create user" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    const row = page
      .getByRole("table", { name: "Users" })
      .getByRole("row", { name: /carol@sympera.ai/ });
    await expect(row).toContainText("must change password");
    await expect(row.getByRole("button", { name: "Disable carol@sympera.ai" })).toBeEnabled();
    await expect(page.getByRole("button", { name: "Disable admin@sympera.ai" })).toBeDisabled();
  });

  test("starts a dataset export and sees it become downloadable", async ({ page }) => {
    await signIn(page, "operator@sympera.ai", "scout-operator");
    await page.goto("/settings/exports");
    await page.getByRole("button", { name: "Start export" }).click();
    const table = page.getByRole("table", { name: "Exports started from this browser" });
    await expect(table.getByText("signals, companies")).toBeVisible();
    await expect(table.getByRole("link", { name: "Download" })).toBeVisible({ timeout: 20_000 });
    await expect(table.getByRole("link", { name: "Download" })).toHaveAttribute(
      "href",
      /\/v1\/artifacts\/export\//,
    );
  });

  test("viewers see read-only explanations", async ({ page }) => {
    await signIn(page, "viewer@sympera.ai", "scout-viewer");
    await page.goto("/settings/keys");
    await expect(page.getByText(/Only admins create or revoke/)).toBeVisible();
    await page.goto("/settings/exports");
    await expect(page.getByText(/need the operator role/)).toBeVisible();
    await page.goto("/settings/users");
    await expect(page).toHaveURL(/\/settings\/workers$/);
  });
});
