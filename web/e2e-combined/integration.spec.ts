/** Real SPA → BFF → API → disposable database acceptance. The harness supplies all fixtures. */
import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

interface Manifest {
  admin_email: string;
  admin_password: string;
  admin_new_password: string;
  job_ids: string[];
  expected_signals: number;
  company_key: string;
  company_name: string;
  company_state: string;
  signal_id: number;
  month_label: string;
  article_id: number;
  expired_article_id: number;
}

const manifestPath = process.env.COMBINED_MANIFEST;
test.skip(!manifestPath, "Run through the disposable combined acceptance harness.");

test("real login, results, repeated signal identity and saved operator state", async ({ page }) => {
  const fixture = JSON.parse(readFileSync(manifestPath!, "utf8")) as Manifest;
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/sign-in");
  await page.getByLabel("E-mail").fill(fixture.admin_email);
  await page.getByLabel("Password", { exact: true }).fill(fixture.admin_password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Choose a new password" })).toBeVisible();
  await page.getByLabel("Current password").fill(fixture.admin_password);
  await page.getByLabel("New password", { exact: true }).fill(fixture.admin_new_password);
  await page.getByLabel("Repeat new password").fill(fixture.admin_new_password);
  await page.getByRole("button", { name: "Change password" }).click();
  await expect(page.getByRole("navigation", { name: "Main" })).toBeVisible();

  await page.goto("/jobs?created=custom");
  const jobs = page.getByRole("table", { name: "Runs" });
  await expect(jobs).toBeVisible();
  for (const jobId of fixture.job_ids)
    await expect(jobs.locator(`a[href="/jobs/${jobId}"]`).first()).toBeVisible();

  await page.goto(`/signals?company_key=${encodeURIComponent(fixture.company_key)}`);
  const signals = page.getByRole("table", { name: "Signals across jobs" });
  await expect(signals.getByRole("link", { name: fixture.company_name, exact: true })).toHaveCount(
    fixture.expected_signals,
  );
  await expect(signals.getByText(fixture.month_label).first()).toBeVisible();
  for (const jobId of fixture.job_ids) {
    await expect(
      signals
        .locator(`a[href*="detail=${fixture.signal_id}"][href*="detail_job=${jobId}"]`)
        .first(),
    ).toBeVisible();
  }
  await page.getByRole("button", { name: "Save view" }).click();
  const view = page.getByRole("dialog", { name: "Save view" });
  await view.getByLabel("View name").fill("Combined acceptance signals");
  await view.getByRole("button", { name: "Save view" }).click();
  await expect(view).toBeHidden();
  await page.reload();
  await expect(page.getByRole("combobox", { name: "Saved view" })).toContainText(
    "Combined acceptance signals",
  );

  const jobId = fixture.job_ids[0]!;
  await page.goto(`/signals?q=not-on-this-page&detail=${fixture.signal_id}&detail_job=${jobId}`);
  const drawer = page.getByRole("dialog", { name: "Signal details" });
  await expect(
    drawer.getByRole("heading", { name: fixture.company_name, exact: true }),
  ).toBeVisible();
  await expect(drawer.getByRole("blockquote")).toContainText(/\S/);
  await expect(drawer.getByText(fixture.month_label, { exact: false }).first()).toBeVisible();
  await drawer.getByRole("button", { name: "Open profile" }).click();
  const profile = page.getByRole("dialog", { name: fixture.company_name, exact: true });
  await expect(profile.getByRole("list", { name: "Company signals" })).toBeVisible();
  await page.goto(`/signals?q=not-on-this-page&detail=${fixture.signal_id}&detail_job=${jobId}`);
  await drawer.getByRole("button", { name: "Saved text" }).click();
  const text = page.getByRole("dialog", { name: "Saved text", exact: true });
  await expect(text.locator("pre")).toContainText(/\S/);

  const expired = await page.request.get(`/v1/articles/${fixture.expired_article_id}?include=text`);
  expect(expired.status()).toBe(410);

  await page.goto(`/jobs/${jobId}/summaries`);
  await expect(page.getByRole("table", { name: "Summaries of this job" })).toBeVisible();
  await page.goto(`/jobs/${jobId}/sections`);
  await expect(page.getByRole("table", { name: "Sections of this job" })).toBeVisible();

  await page.goto("/sources");
  await page.getByRole("button", { name: "Add source" }).click();
  const source = page.getByRole("dialog", { name: "Add source" });
  await source.getByLabel("Name", { exact: true }).fill("Combined acceptance source");
  await source.getByLabel("URL", { exact: true }).fill("https://acceptance.example.test");
  await source.getByLabel("County", { exact: true }).fill("Orange");
  await source.getByRole("combobox", { name: "State" }).click();
  await page.getByRole("option", { name: "Florida (FL)" }).click();
  await source.getByRole("button", { name: "Add source" }).click();
  await expect(source).toBeHidden();
  await page.reload();
  await expect(
    page.getByRole("table", { name: "Data sources" }).getByText("Combined acceptance source"),
  ).toBeVisible();

  await page.goto(`/jobs/new?from=${jobId}`);
  await page.getByLabel("Save as Scout", { exact: true }).check();
  await page.getByLabel("Scout name", { exact: true }).fill("Combined acceptance Scout");
  await page.getByRole("button", { name: "Save Scout without running" }).click();
  await expect(page).toHaveURL(/\/jobs\/scouts$/);
  await expect(
    page.getByRole("table", { name: "Scouts" }).getByText("Combined acceptance Scout"),
  ).toBeVisible();
  await page.goto("/settings/access-policies");
  await expect(page.getByRole("heading", { name: "Website access", exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});
