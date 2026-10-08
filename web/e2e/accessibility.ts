/// <reference lib="dom" />
import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";

/** Measure the final colours, after theme transitions and dialog fades finish. */
export async function expectAccessible(page: Page, label: string) {
  await page.evaluate(async () => {
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    const animations = document.getAnimations().filter((animation) => {
      const timing = animation.effect?.getComputedTiming();
      return timing && Number.isFinite(timing.endTime);
    });
    await Promise.allSettled(animations.map((animation) => animation.finished));
  });
  const results = await new AxeBuilder({ page })
    .exclude("[data-sonner-toaster]")
    .withTags(["wcag2a", "wcag2aa", "best-practice"])
    .analyze();
  const serious = results.violations.filter(
    (violation) => violation.impact === "serious" || violation.impact === "critical",
  );
  const summary = serious
    .map(
      (violation) =>
        `${violation.id}: ${violation.help} (${violation.nodes.map((node) => node.target.join(" ")).join("; ")})`,
    )
    .join("\n");
  expect(serious, `${label} has accessibility violations:\n${summary}`).toEqual([]);
}
