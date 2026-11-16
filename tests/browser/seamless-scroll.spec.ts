import { test, expect, type Page } from "@playwright/test";
import { seedInlineCatalog } from "./inlineSearchFixture";
async function drain(page: Page) {
  await expect
    .poll(
      async () => {
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
        return page.locator(".library-page-boundary").count();
      },
      { timeout: 15000 },
    )
    .toBe(0);
  await page.evaluate(() =>
    (
      document.querySelector<HTMLElement>(
        '.library-pane[data-active="true"]',
      ) ?? window
    ).scrollTo({
      top:
        document.querySelector<HTMLElement>('.library-pane[data-active="true"]')
          ?.scrollHeight ?? document.documentElement.scrollHeight,
      behavior: "instant",
    }),
  );
}
test("phone Songs scrolls through the catalog without Load more and retains bounded rendered rows", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await seedInlineCatalog(page);
  await expect(
    page.getByRole("button", { name: "Load more", exact: true }),
  ).toHaveCount(0);
  await drain(page);
  await expect(page.locator('[data-track-id="entry-128"]')).toBeVisible();
  expect(
    await page.locator("#library-content .track-row").count(),
  ).toBeLessThan(120);
});
test("Albums and Artists expose the complete catalog; desktop also needs no paging button", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await seedInlineCatalog(page);
  for (const name of ["Albums", "Artists"]) {
    await page.getByRole("tab", { name, exact: true }).click();
    await expect(
      page.locator("#library-content .album-card").first(),
    ).toBeVisible();
    await drain(page);
    await expect(page.locator("#library-content .album-grid")).toHaveAttribute(
      "data-catalog-total",
      "130",
    );
    expect(
      await page.locator("#library-content .album-card").count(),
    ).toBeLessThan(60);
  }
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.reload();
  await page.getByRole("tab", { name: "Songs", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Load more", exact: true }),
  ).toHaveCount(0);
});
test("filtered phone scrolling stays in scope and clearing restores ordinary browsing", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await seedInlineCatalog(page);
  await page
    .getByRole("button", { name: "Search your library", exact: true })
    .click();
  await page.getByRole("searchbox").fill("Song");
  await expect(page.locator(".inline-search-status")).not.toHaveAttribute(
    "aria-busy",
    "true",
  );
  await expect(
    page.locator("#library-content .track-copy strong").first(),
  ).toContainText("Song");
  await drain(page);
  expect(
    await page.locator("#library-content .track-row").count(),
  ).toBeLessThan(120);
  await page.evaluate(() =>
    (
      document.querySelector<HTMLElement>(
        '.library-pane[data-active="true"]',
      ) ?? window
    ).scrollTo(0, 0),
  );
  await page.locator("#library-content [data-search-clear]").click();
  await expect(
    page.locator("#library-content [data-search-clear]"),
  ).toHaveCount(0);
  await expect(page.locator("#library-content .collection-count")).toHaveText(
    "130 songs",
  );
});
