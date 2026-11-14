import { test, expect } from "@playwright/test";
import { seedInlineCatalog } from "./inlineSearchFixture";
test("warmed phone groups render a bounded window and deep Back restores the original card", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await seedInlineCatalog(page);
  await page.waitForTimeout(2000);
  for (const name of ["Albums", "Artists"]) {
    await page.getByRole("tab", { name, exact: true }).click();
    await expect(page.locator(".album-grid")).toHaveAttribute(
      "data-catalog-total",
      "130",
    );
    expect(await page.locator(".album-card").count()).toBeLessThan(60);
    const title = name === "Albums" ? "Record 129" : "Person 129";
    await expect
      .poll(async () => {
        await page.evaluate(() =>
          scrollTo({
            top: document.documentElement.scrollHeight,
            behavior: "instant",
          }),
        );
        return page
          .locator(".album-card")
          .filter({ has: page.locator("strong", { hasText: title }) })
          .count();
      })
      .toBe(1);
    const card = page
      .locator(".album-card")
      .filter({ has: page.locator("strong", { hasText: title }) });
    const key = await card.getAttribute("data-group-key");
    await card.click();
    await expect(page.locator(".collection-hero")).toBeVisible();
    await page.locator(".group-back").click();
    await expect(
      page.locator(`[data-group-key=${JSON.stringify(key)}]`),
    ).toBeFocused();
    expect(await page.locator(".album-card").count()).toBeLessThan(60);
  }
});
