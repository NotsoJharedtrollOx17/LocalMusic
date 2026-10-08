import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
test("main journeys expose accessible controls at mobile width", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "Explore with sample audio" }).click();
  await expect(page.getByText("8 songs", { exact: true })).toBeVisible();
  for (const name of ["Library", "Playlists", "Your Year"]) {
    await page.locator(".bottom-nav").getByRole("button", { name }).click();
    await expect
      .poll(async () =>
        (
          await new AxeBuilder({ page })
            .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
            .analyze()
        ).violations.map((v) => ({
          id: v.id,
          nodes: v.nodes.map((n) => n.target),
        })),
      )
      .toEqual([]);
  }
  await page
    .locator(".mobile-brand")
    .getByRole("button", { name: "Settings" })
    .click();
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
});
