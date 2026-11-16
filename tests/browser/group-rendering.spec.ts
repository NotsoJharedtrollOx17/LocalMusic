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
    await expect(page.locator("#library-content .album-grid")).toHaveAttribute(
      "data-catalog-total",
      "130",
    );
    if (name === "Artists") {
      const cards = page.locator("#library-content .album-card");
      const first = (await cards.nth(0).boundingBox())!;
      const second = (await cards.nth(1).boundingBox())!;
      expect(second.y - first.y - first.height).toBeLessThanOrEqual(1);
    }
    expect(
      await page.locator("#library-content .album-card").count(),
    ).toBeLessThan(60);
    const title = name === "Albums" ? "Record 129" : "Person 129";
    await expect
      .poll(async () => {
        await page.evaluate(() =>
          (
            document.querySelector<HTMLElement>(
              '.library-pane[data-active="true"]',
            ) ?? window
          ).scrollTo({
            top:
              document.querySelector<HTMLElement>(
                '.library-pane[data-active="true"]',
              )?.scrollHeight ?? document.documentElement.scrollHeight,
            behavior: "instant",
          }),
        );
        return page
          .locator("#library-content .album-card")
          .filter({ has: page.locator("strong", { hasText: title }) })
          .count();
      })
      .toBe(1);
    const card = page
      .locator("#library-content .album-card")
      .filter({ has: page.locator("strong", { hasText: title }) });
    const key = await card.getAttribute("data-group-key");
    await card.click();
    await expect(
      page.locator("#library-content .collection-hero"),
    ).toBeVisible();
    await page.locator(".group-back").click();
    await expect(
      page.locator(`[data-group-key=${JSON.stringify(key)}]`),
    ).toBeFocused();
    expect(
      await page.locator("#library-content .album-card").count(),
    ).toBeLessThan(60);
  }
});
