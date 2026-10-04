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

/** Collects JS errors; the browser's own "Failed to load resource" line for the expected 401 of
 * `GET /app/auth/me` before sign-in is not an application error and is ignored. */
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

test.describe("Sympera Scout shell (mock mode)", () => {
  test("signs in, shows the shell and the overview", async ({ page }) => {
    const errors = trackConsole(page);
    await page.goto("/");
    await expect(page).toHaveURL(/\/sign-in\?redirect=/);
    await expect(page).toHaveTitle("Sympera Scout");
    await expectAccessible(page, "sign-in");

    await signIn(page);
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("heading", { level: 1, name: "Overview" })).toBeVisible();
    await expect(page.getByText("Everything running right now, and what needs you")).toBeVisible();
    await expect(page.getByRole("region", { name: "Key figures" })).toBeVisible();
    await expect(page.getByText("API ready")).toBeVisible();
    await expect(page.getByText("admin", { exact: true })).toBeVisible();
    await expect(
      page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Overview" }),
    ).toHaveAttribute("aria-current", "page");
    await expectAccessible(page, "overview");
    expect(errors).toEqual([]);
  });

  test("renders every area and passes axe", async ({ page }) => {
    const errors = trackConsole(page);
    await signIn(page);

    await page.goto("/jobs");
    await expect(page.getByRole("heading", { level: 1, name: "Jobs" })).toBeVisible();
    await expect(
      page.getByRole("navigation", { name: "Sections" }).getByRole("link", { name: "Runs" }),
    ).toHaveAttribute("aria-current", "page");
    await expectAccessible(page, "jobs");

    await page.goto(`/jobs/${MAIN_JOB_ID}`);
    await expect(
      page.getByRole("heading", { level: 1, name: "Orange County, FL · Construction" }),
    ).toBeVisible();
    await expect(page.getByText("Analysing", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("batch 1 of 3")).toBeVisible();
    await expect(page.getByRole("button", { name: "Cancel run" })).toBeEnabled();
    await expect(page.getByRole("button", { name: "Resume" })).toBeDisabled();
    await page.getByRole("button", { name: /Export CSV/ }).click();
    await expect(page.getByRole("menuitem", { name: /Company flags/ })).toHaveAttribute(
      "href",
      `/v1/jobs/${MAIN_JOB_ID}/export/company_flags.csv`,
    );
    await page.keyboard.press("Escape");
    await expect(page.getByRole("menu")).toBeHidden();
    await expectAccessible(page, "job detail");

    await page
      .getByRole("navigation", { name: "Sections" })
      .getByRole("link", { name: /Signals/ })
      .click();
    await expect(page).toHaveURL(new RegExp(`/jobs/${MAIN_JOB_ID}/signals$`));
    await expect(page.getByLabel("Job summary")).toContainText("139 companies · 24 signals");
    await expectAccessible(page, "job signals tab");

    await page.goto("/signals");
    await expect(page.getByRole("heading", { level: 1, name: "Signals" })).toBeVisible();
    await expectAccessible(page, "signals");

    await page.goto("/sources");
    await expect(page.getByRole("heading", { level: 1, name: "Data Sources" })).toBeVisible();
    await expectAccessible(page, "sources");

    await page.goto("/settings/workers");
    await expect(page.getByRole("heading", { level: 1, name: "Settings" })).toBeVisible();
    await expect(
      page
        .getByRole("navigation", { name: "Settings sections" })
        .getByRole("link", { name: "Workers & health" }),
    ).toHaveAttribute("aria-current", "page");
    await expect(page.getByRole("link", { name: "Users" })).toBeVisible();
    await expectAccessible(page, "settings workers");

    await page.goto("/settings");
    await expect(page).toHaveURL(/\/settings\/workers$/);
    expect(errors).toEqual([]);
  });

  test("opens the command palette with the keyboard and closes it with Escape", async ({
    page,
  }) => {
    await signIn(page);
    await page.keyboard.press("ControlOrMeta+k");
    const palette = page.getByRole("dialog", { name: "Command palette" });
    await expect(palette).toBeVisible();
    await expect(palette.getByPlaceholder("Search pages, jump to a job by id…")).toBeFocused();
    await palette.getByPlaceholder("Search pages, jump to a job by id…").fill("Data");
    await expect(palette.getByRole("option", { name: /Data Sources/ })).toBeVisible();
    await expectAccessible(page, "command palette");
    await page.keyboard.press("Escape");
    await expect(palette).toBeHidden();

    await page.getByRole("button", { name: "Search jobs, companies and signals" }).click();
    await expect(palette).toBeVisible();
    await palette.getByPlaceholder("Search pages, jump to a job by id…").fill("Scouts");
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/jobs\/scouts$/);
  });

  test("viewers see no mutating controls and sign out returns to sign-in", async ({ page }) => {
    await signIn(page, "viewer@sympera.ai", "scout-viewer");
    await page.goto(`/jobs/${MAIN_JOB_ID}`);
    await expect(
      page.getByRole("heading", { level: 1, name: "Orange County, FL · Construction" }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Cancel run" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Export CSV/ })).toBeVisible();

    await page.getByRole("button", { name: "Account menu" }).click();
    await page.getByRole("menuitem", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/sign-in$/);
    await page.goto("/jobs");
    await expect(page).toHaveURL(/\/sign-in\?redirect=%2Fjobs$/);
  });
});
