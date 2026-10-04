import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

async function signIn(page: Page, email = "admin@sympera.ai", password = "scout-admin") {
  await page.goto("/sign-in");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("navigation", { name: "Main" })).toBeVisible();
}

async function expectAccessible(page: Page, label: string) {
  const results = await new AxeBuilder({ page })
    .exclude("[data-sonner-toaster]")
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

const CSV = [
  "name,url,county,state,industries",
  "Apopka Voice,https://apopkavoice.com,Orange County,Florida,Construction;Manufacturing",
  "Orlando Magazine,https://orlandomagazine.com,Orange,FL,Construction",
  "No URL,,Orange,FL,",
].join("\n");

test.describe("Scouts and Data Sources (mock mode)", () => {
  test("runs a Scout from the Scouts tab and sees the new run on the next visit", async ({
    page,
  }) => {
    const errors = trackConsole(page);
    await signIn(page);
    await page.goto("/jobs/scouts");
    const table = page.getByRole("table", { name: "Scouts" });
    await expect(table.getByText("Orange County builders")).toBeVisible();
    await expect(table.getByRole("row")).toHaveCount(6);
    await expect(page.getByRole("note")).toContainText("A Scout is a saved setup");
    await expect(
      page.getByRole("navigation", { name: "Sections" }).getByRole("link", { name: /Scouts/ }),
    ).toHaveAttribute("aria-current", "page");
    await expectAccessible(page, "scouts");

    await page.getByRole("button", { name: "How Scouts work" }).click();
    await expect(page.getByRole("dialog", { name: "How Scouts work" })).toBeVisible();
    await page.getByRole("button", { name: "Got it" }).click();

    const houston = table.getByRole("row").filter({ hasText: "Houston manufacturing" });
    await expect(houston).toContainText("Finder · top 5 sites");
    await expect(houston).toContainText("2");
    await houston.getByRole("button", { name: "Run Scout Houston manufacturing" }).click();
    const confirm = page.getByRole("dialog", { name: "Run Houston manufacturing?" });
    await expect(confirm).toContainText("This will create 1 job for Houston manufacturing");
    await expectAccessible(page, "run confirm");
    await confirm.getByRole("button", { name: "Create 1 job" }).click();
    await expect(page.getByText("Houston manufacturing · run 3")).toBeVisible();
    await expect(page.getByText("1 job created. They are listed under Runs.")).toBeVisible();

    // The in-memory mock keeps the batch while the SPA navigates (no reload).
    await page.getByRole("button", { name: "View runs" }).click();
    await expect(page).toHaveURL(/\/jobs\?scout=a1b2c3d4-0003-4a00-8000-000000000003$/);
    await page
      .getByRole("navigation", { name: "Sections" })
      .getByRole("link", { name: /Scouts/ })
      .click();
    const refreshed = page
      .getByRole("table", { name: "Scouts" })
      .getByRole("row")
      .filter({ hasText: "Houston manufacturing" });
    await expect(refreshed).toContainText("just now");
    await expect(refreshed).toContainText("Queued");
    await expect(refreshed.getByRole("cell").nth(5)).toHaveText("3");

    await refreshed
      .getByRole("button", { name: "More actions for Scout Houston manufacturing" })
      .click();
    await expect(page.getByRole("menuitem", { name: "Duplicate" })).toHaveAttribute(
      "href",
      "/jobs/new?scout=a1b2c3d4-0003-4a00-8000-000000000003&duplicate=1",
    );
    await page.keyboard.press("Escape");
    expect(errors).toEqual([]);
  });

  test("curates Data Sources: add, import, promote, remove and restore", async ({ page }) => {
    const errors = trackConsole(page);
    await signIn(page);
    await page.goto("/sources");
    const table = page.getByRole("table", { name: "Data sources" });
    await expect(table.getByText("Orlando Magazine")).toBeVisible();
    await expect(page.getByRole("group", { name: "Source statistics" })).toContainText(
      "Active sources23",
    );
    await expectAccessible(page, "sources");

    // Add
    await page.getByRole("button", { name: "Add source" }).click();
    const add = page.getByRole("dialog", { name: "Add source" });
    await add.getByLabel("Name").fill("Winter Park Magazine");
    await add.getByLabel("URL").fill("https://www.winterparkmag.com");
    await add.getByLabel("County").fill("Orange");
    await add.getByRole("combobox", { name: "State" }).click();
    await page.getByRole("option", { name: "Florida (FL)" }).click();
    await add.getByRole("textbox", { name: "Industries" }).fill("Construction");
    await add.getByRole("textbox", { name: "Industries" }).press("Enter");
    await expectAccessible(page, "add source dialog");
    await add.getByRole("button", { name: "Add source" }).click();
    await expect(add).toBeHidden();
    await expect(table.getByText("Winter Park Magazine")).toBeVisible();
    await expect(table.getByRole("link", { name: "winterparkmag.com" })).toBeVisible();

    // Import CSV
    await page.getByRole("button", { name: "Import CSV" }).click();
    const importDialog = page.getByRole("dialog", { name: "Import sources from CSV" });
    await importDialog
      .getByLabel("CSV file")
      .setInputFiles({ name: "sources.csv", mimeType: "text/csv", buffer: Buffer.from(CSV) });
    await importDialog.getByRole("button", { name: "Import" }).click();
    await expect(importDialog.getByRole("status")).toContainText("Imported 1 source, skipped 2.");
    await expect(importDialog.getByRole("status")).toContainText(
      "row 3 · already listed for this county and state",
    );
    await expect(importDialog.getByRole("status")).toContainText("row 4 · invalid url");
    await importDialog.getByRole("button", { name: "Done" }).click();
    await expect(table.getByText("Apopka Voice")).toBeVisible();

    // Promote a suggestion
    await page.getByRole("button", { name: "Add orlandoweekly.com to sources" }).click();
    const promote = page.getByRole("dialog", { name: "Add to sources" });
    await expect(promote.getByLabel("Name")).toHaveValue("Orlando Weekly");
    await promote.getByRole("button", { name: "Add to sources" }).click();
    await expect(promote).toBeHidden();
    await expect(table.getByText("Orlando Weekly")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Add orlandoweekly.com to sources" }),
    ).toHaveCount(0);

    // See all / dismiss (11 suggestions minus the 3 domains now listed)
    await page.getByRole("button", { name: /^See all 8$/ }).click();
    await expect(page.getByRole("button", { name: "Show fewer" })).toBeVisible();
    await page.getByRole("button", { name: "Dismiss floridadaily.com" }).click();
    await expect(page.getByRole("button", { name: "Dismiss floridadaily.com" })).toHaveCount(0);

    // Remove, then restore from the removed view
    await page.getByRole("button", { name: "Remove GrowthSpotter" }).click();
    await page
      .getByRole("dialog", { name: "Remove GrowthSpotter?" })
      .getByRole("button", { name: "Remove" })
      .click();
    await expect(table.getByText("GrowthSpotter", { exact: true })).toHaveCount(0);
    await page.getByRole("combobox", { name: "Status" }).click();
    await page.getByRole("option", { name: "removed" }).click();
    await expect(page).toHaveURL(/status=removed/);
    await expect(table.getByText("GrowthSpotter", { exact: true })).toBeVisible();
    await expect(table.getByText("Prairie Post")).toBeVisible();
    await page.getByRole("button", { name: "Restore GrowthSpotter" }).click();
    await expect(table.getByText("GrowthSpotter", { exact: true })).toHaveCount(0);
    await expectAccessible(page, "sources removed view");
    expect(errors).toEqual([]);
  });

  test("viewers can read Scouts and Data Sources but change nothing", async ({ page }) => {
    await signIn(page, "viewer@sympera.ai", "scout-viewer");
    await page.goto("/jobs/scouts");
    await expect(
      page.getByRole("table", { name: "Scouts" }).getByText("Phoenix retail"),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: /Run Scout/ })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "New run" })).toHaveCount(0);

    await page.goto("/sources");
    await expect(
      page.getByRole("table", { name: "Data sources" }).getByText("Orlando Magazine"),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Add source" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /^Remove / })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Add .* to sources/ })).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Export CSV of the listed sources" }),
    ).toBeEnabled();
    await expectAccessible(page, "sources as viewer");
  });
});
