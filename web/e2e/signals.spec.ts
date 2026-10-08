import { expectAccessible } from "./accessibility";
import { expect, test, type Page } from "@playwright/test";

const MAIN_JOB_ID = "0192f1c2-7e0a-4c1b-9d33-5a1e8b2f0c41";

async function signIn(page: Page, email = "admin@sympera.ai", password = "scout-admin") {
  await page.goto("/sign-in");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("navigation", { name: "Main" })).toBeVisible();
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

test.describe("Signals explorer (mock mode)", () => {
  test("filters with chips, saves a view and reopens it", async ({ page }) => {
    const errors = trackConsole(page);
    await signIn(page);
    await page.goto("/signals");
    await expect(page.getByRole("heading", { level: 1, name: "Signals" })).toBeVisible();
    const table = page.getByRole("table", { name: "Signals across jobs" });
    await expect(table.getByRole("row")).not.toHaveCount(1);
    await expect(page.getByRole("group", { name: "Active filters" })).toContainText(
      /\d+ signals · \d+ companies · \d+ jobs/,
    );
    await expect(page.getByRole("link", { name: /Export CSV/ })).toHaveAttribute(
      "href",
      "/app/signals/export.csv",
    );
    await expectAccessible(page, "signals explorer");

    // Add a filter through the picker, see the chip and the URL, remove it again.
    await page.getByRole("button", { name: "Add filter" }).click();
    await page.getByRole("button", { name: "State", exact: true }).click();
    await page.getByLabel("State", { exact: true }).fill("GA");
    await page.getByRole("button", { name: "Apply" }).click();
    await expect(page).toHaveURL(/state=GA/);
    const chips = page.getByRole("group", { name: "Active filters" });
    await expect(chips.getByText("State: GA")).toBeVisible();
    await expect(table.getByRole("link", { name: "Peachtree Distribution" })).toBeVisible();
    await expect(page.getByRole("link", { name: /Export CSV/ })).toHaveAttribute(
      "href",
      "/app/signals/export.csv?state=GA",
    );

    await page.getByRole("button", { name: "Add filter" }).click();
    await page.getByRole("button", { name: "Materiality" }).click();
    await page.getByRole("combobox", { name: "Materiality" }).click();
    await page.getByRole("option", { name: "High" }).click();
    await page.getByRole("button", { name: "Apply" }).click();
    await expect(page).toHaveURL(/materiality=High/);
    await expect(chips.getByText("Materiality: High")).toBeVisible();

    // Save the current filters as a view and reopen it from the select.
    await page.getByRole("button", { name: "Save view" }).click();
    const dialog = page.getByRole("dialog", { name: "Save view" });
    await dialog.getByLabel("View name").fill("Georgia highs");
    await dialog.getByRole("button", { name: "Save view" }).click();
    await expect(dialog).toBeHidden();
    await expect(page).toHaveURL(/view=/);
    await expect(page.getByRole("combobox", { name: "Saved view" })).toContainText("Georgia highs");

    await chips.getByRole("button", { name: "Remove filter State: GA" }).click();
    await expect(page).not.toHaveURL(/state=GA/);
    await expect(page).not.toHaveURL(/view=/);
    await page.getByRole("button", { name: "Clear all" }).click();
    await expect(page).not.toHaveURL(/materiality=/);

    await page.getByRole("combobox", { name: "Saved view" }).click();
    await page.getByRole("option", { name: /Georgia highs/ }).click();
    await expect(page).toHaveURL(/state=GA/);
    await expect(page).toHaveURL(/materiality=High/);
    await expect(chips.getByText("State: GA")).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("opens the drawer from a row, steps to the next signal and closes it", async ({ page }) => {
    const errors = trackConsole(page);
    await signIn(page, "viewer@sympera.ai", "scout-viewer");
    await page.goto("/signals");
    const table = page.getByRole("table", { name: "Signals across jobs" });
    const firstCompany = table.getByRole("row").nth(1).getByRole("link").first();
    const name = (await firstCompany.textContent())?.trim() ?? "";
    await firstCompany.click();

    const drawer = page.getByRole("dialog", { name: "Signal details" });
    await expect(drawer).toBeVisible();
    await expect(page).toHaveURL(/detail=\d+/);
    await expect(page).toHaveURL(/detail_job=/);
    await expect(drawer.getByRole("heading", { level: 2 })).toHaveText(name);
    await expect(drawer.getByRole("blockquote")).toContainText(/\S/);
    await expect(drawer.getByText("verbatim match")).toBeVisible();
    await expect(drawer.getByText("Main idea:")).toBeVisible();
    await expect(drawer.getByText("Company profile")).toBeVisible();
    await expect(drawer.getByTestId("across-jobs")).toContainText(/mention/);
    await expect(drawer.getByRole("button", { name: "Copy link" })).toBeVisible();
    await expect(drawer.getByRole("button", { name: "Export row" })).toBeVisible();
    await expectAccessible(page, "signal drawer");

    const url = page.url();
    await drawer.getByRole("button", { name: "Next" }).click();
    await expect(page).not.toHaveURL(url);
    await expect(drawer.getByRole("heading", { level: 2 })).not.toHaveText(name);

    await drawer.getByRole("button", { name: "Saved text" }).click();
    const saved = page.getByRole("dialog", { name: "Saved text" });
    await expect(saved).toBeVisible();
    await expect(saved.locator("pre")).toContainText(/\S/);
    await page.keyboard.press("Escape");
    await expect(saved).toBeHidden();

    await page.keyboard.press("Escape");
    await expect(drawer).toBeHidden();
    await expect(page).not.toHaveURL(/detail=/);
    expect(errors).toEqual([]);
  });

  test("job signals tab renders the job columns and opens the drawer", async ({ page }) => {
    const errors = trackConsole(page);
    await signIn(page);
    await page.goto(`/jobs/${MAIN_JOB_ID}/signals`);
    await expect(page.getByLabel("Job summary")).toContainText("139 companies · 24 signals");
    const table = page.getByRole("table", { name: "Signals of this job" });
    await expect(table.getByRole("row")).toHaveCount(25);
    await expect(table.getByRole("columnheader", { name: "HQ city · scope" })).toBeVisible();
    await expect(table.getByRole("columnheader", { name: "Source" })).toBeVisible();
    await expect(page.getByText(/Showing 1–24 of 24 signals/)).toBeVisible();
    await expect(page.getByRole("link", { name: /signals\.csv/ })).toHaveAttribute(
      "href",
      `/app/signals/export.csv?job_id=${MAIN_JOB_ID}`,
    );
    await expectAccessible(page, "job signals tab");

    await page.getByRole("combobox", { name: "Materiality" }).click();
    await page.getByRole("option", { name: "High" }).click();
    await expect(page).toHaveURL(/materiality=High/);
    await expect(table.getByRole("link", { name: "Lakeview Builders Group" })).toBeVisible();

    await table.getByRole("link", { name: "Open signal details" }).first().click();
    const drawer = page.getByRole("dialog", { name: "Signal details" });
    await expect(drawer).toBeVisible();
    await expect(drawer.getByText(/Orange County, FL · Construction · /)).toBeVisible();
    await expect(
      drawer.getByRole("link", { name: "Orange County, FL · Construction" }),
    ).toHaveAttribute("href", `/jobs/${MAIN_JOB_ID}`);
    await drawer.getByRole("button", { name: "Close details" }).click();
    await expect(drawer).toBeHidden();
    expect(errors).toEqual([]);
  });
});
