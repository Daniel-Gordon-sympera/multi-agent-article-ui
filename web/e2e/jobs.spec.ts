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

async function selectOption(page: Page, label: string, option: string) {
  await page.getByRole("combobox", { name: label }).click();
  await page.getByRole("option", { name: option }).click();
}

test.describe("Jobs (mock mode)", () => {
  test("Runs: filters, the row cancel flow and the Scout chip", async ({ page }) => {
    const errors = trackConsole(page);
    await signIn(page);
    await page.goto("/jobs");
    const table = page.getByRole("table", { name: "Runs" });
    await expect(
      table.getByRole("link", { name: "Orange County, FL · Construction" }),
    ).toBeVisible();
    await expect(table.getByText("batch 1 of 3")).toBeVisible();
    await expect(table.getByText("5 / 5").first()).toBeVisible();
    await expectAccessible(page, "runs");

    await selectOption(page, "Status", "Partial");
    await expect(page).toHaveURL(/status=partial/);
    await expect(table.getByRole("row")).toHaveCount(2);
    await expect(table.getByText("site_time_limit")).toBeVisible();
    await selectOption(page, "Status", "Status: all");

    await page.getByRole("searchbox").fill("Cook");
    await expect(table.getByRole("row")).toHaveCount(2);
    await expect(table.getByText("no_sources_found")).toBeVisible();
    await page.getByRole("button", { name: "Clear search" }).click();

    await table.getByRole("button", { name: "Cancel job 0192f1c2" }).click();
    const dialog = page.getByRole("dialog", { name: "Cancel this run?" });
    await expect(dialog).toBeVisible();
    await expectAccessible(page, "cancel dialog");
    await dialog.getByRole("button", { name: "Cancel run" }).click();
    await expect(table.getByText("Cancelling")).toBeVisible();

    await page.goto("/jobs?scout=a1b2c3d4-0001-4a00-8000-000000000001");
    await expect(page.getByText("Runs of Scout Orange County builders")).toBeVisible();
    await expect(page.getByRole("table", { name: "Runs" }).getByRole("row")).toHaveCount(4);
    expect(errors).toEqual([]);
  });

  test("New run: a 3-industry setup fans out into 3 runs with batch chips", async ({ page }) => {
    const errors = trackConsole(page);
    await signIn(page, "operator@sympera.ai", "scout-operator");
    await page.goto("/jobs/new?scoutMode=save");
    await expect(page.getByRole("heading", { level: 1, name: "New run" })).toBeVisible();
    await selectOption(page, "State", "Florida (FL)");
    await page.getByRole("textbox", { name: "County" }).fill("Orange");
    await expect(page.getByRole("textbox", { name: "Location phrase for the finder" })).toHaveValue(
      "Orange County, FL",
    );
    const industries = page.getByRole("combobox", { name: "Industries" });
    for (const name of ["Construction", "Manufacturing", "Wholesale Trade"]) {
      await industries.fill(name.slice(0, 5));
      await page.getByRole("option", { name }).click();
    }
    await expect(page.getByText("This will create 3 jobs")).toBeVisible();
    await expect(page.getByText(/3 active sources match Orange County, FL/)).toBeVisible();
    await page.getByRole("textbox", { name: "Scout name" }).fill("Orange County builders II");
    await expectAccessible(page, "new run");

    await page.getByRole("button", { name: "Create 3 jobs" }).click();
    await expect(page).toHaveURL(/\/jobs\?scout=/);
    await expect(page.getByText("Created 3 jobs")).toBeVisible();
    const table = page.getByRole("table", { name: "Runs" });
    await expect(table.getByRole("row")).toHaveCount(4);
    await expect(table.getByText("batch 1 of 3")).toBeVisible();
    await expect(table.getByText("batch 3 of 3")).toBeVisible();
    await expect(table.getByText("Queued")).toHaveCount(3);
    expect(errors).toEqual([]);
  });

  test("Job detail: overview, results tabs and retrying a dead task", async ({ page }) => {
    const errors = trackConsole(page);
    await signIn(page, "operator@sympera.ai", "scout-operator");
    await page.goto(`/jobs/${MAIN_JOB_ID}`);
    await expect(page.getByRole("heading", { level: 2, name: "Pipeline progress" })).toBeVisible();
    await expect(page.getByText("Auto-refresh every 5 s")).toBeVisible();
    await expect(page.getByRole("list", { name: "Pipeline stages" })).toContainText("Analysing");
    await expect(page.getByRole("table", { name: "Site runs" }).getByRole("row")).toHaveCount(6);
    await expect(page.getByRole("heading", { level: 2, name: "Cost by stage" })).toBeVisible();
    await expect(page.getByText("Proxy traffic: 56.8 MB so far", { exact: false })).toBeVisible();
    await expectAccessible(page, "job overview");

    await page.getByRole("button", { name: "Exploration of orlandomagazine.com" }).click();
    await expect(
      page.getByRole("dialog", { name: /Exploration · orlandomagazine.com/ }),
    ).toBeVisible();
    await page.keyboard.press("Escape");

    const tabs = page.getByRole("navigation", { name: "Sections" });
    await tabs.getByRole("link", { name: /Companies/ }).click();
    await expect(page.getByRole("table", { name: "Companies of this job" })).toBeVisible();
    await expect(page.getByText("Lakeview Builders Group")).toBeVisible();
    await page.getByRole("switch", { name: "One row per company" }).click();
    await expect(page).toHaveURL(/view=flags/);
    await expect(
      page.getByRole("table", { name: "Companies of this job (one row per company)" }),
    ).toBeVisible();
    await expectAccessible(page, "companies");

    await tabs.getByRole("link", { name: /Summaries/ }).click();
    await page
      .getByRole("button", { name: /Summary record of/ })
      .first()
      .click();
    await expect(page.getByRole("dialog", { name: "Summary record" })).toBeVisible();
    await expectAccessible(page, "summary drawer");
    await page.keyboard.press("Escape");

    await tabs.getByRole("link", { name: /Articles/ }).click();
    await page
      .getByRole("button", { name: /Saved text of/ })
      .first()
      .click();
    await expect(page.getByRole("dialog")).toContainText("Saved article text (mock)");
    await page.keyboard.press("Escape");

    await tabs.getByRole("link", { name: /Tasks/ }).click();
    await expect(page).toHaveURL(new RegExp(`/jobs/${MAIN_JOB_ID}/tasks$`));
    const tasks = page.getByRole("table", { name: "Tasks of this job" });
    await expect(tasks.getByRole("row")).toHaveCount(13);
    await expect(page.getByRole("group", { name: "Task status counts" })).toContainText("dead");
    await expectAccessible(page, "tasks");
    await tasks.getByRole("button", { name: "Retry task 48920" }).click();
    await expect(page.getByText("Task #48920 re-queued")).toBeVisible();
    await expect(tasks.getByRole("button", { name: "Retry task 48920" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Retry all dead" })).toBeDisabled();

    await tabs.getByRole("link", { name: /Events/ }).click();
    await expect(page.getByRole("table", { name: "Events of this job" })).toBeVisible();
    await expect(page.getByText("oldest first")).toBeVisible();
    await expectAccessible(page, "events");

    await tabs.getByRole("link", { name: /Site runs/ }).click();
    await expect(page.getByRole("heading", { name: "Finder sources & ranking" })).toBeVisible();
    await page.getByRole("button", { name: "Work items of bizjournals.com/orlando" }).click();
    await expect(page).toHaveURL(/work=/);
    await expect(page.getByRole("dialog", { name: "Work items" })).toBeVisible();
    await expectAccessible(page, "work items drawer");
    await page.keyboard.press("Escape");

    await tabs.getByRole("link", { name: /Sections/ }).click();
    await expect(page.getByRole("table", { name: "Sections of this job" })).toBeVisible();
    await expectAccessible(page, "sections");
    expect(errors).toEqual([]);
  });

  test("Viewers read every tab without mutating controls", async ({ page }) => {
    await signIn(page, "viewer@sympera.ai", "scout-viewer");
    await page.goto("/jobs");
    await expect(page.getByRole("table", { name: "Runs" })).toBeVisible();
    await expect(page.getByRole("button", { name: /Cancel job/ })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "New run" })).toHaveCount(0);
    await page.goto(`/jobs/${MAIN_JOB_ID}/tasks`);
    await expect(page.getByRole("table", { name: "Tasks of this job" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Retry all dead" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Retry task/ })).toHaveCount(0);
  });
});
