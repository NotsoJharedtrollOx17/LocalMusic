import { taggedWav } from "./fixtures";
import { test, expect } from "@playwright/test";
import { seedInlineCatalog } from "./inlineSearchFixture";
test("startup prepares complete catalogs with bounded neighboring previews and revisits retain every entry", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await seedInlineCatalog(page);
  // Give scheduled background batches time while the user stays in Songs.
  await page.waitForTimeout(2000);
  await expect(page.locator("#library-content .album-card")).toHaveCount(0);
  expect(
    await page.locator(".library-pane[aria-hidden=true] .album-card").count(),
  ).toBeGreaterThan(0);
  expect(await page.locator(".library-pane").count()).toBeLessThanOrEqual(3);
  for (const name of ["Albums", "Artists", "Albums"]) {
    const immediate = await page
      .getByRole("tab", { name, exact: true })
      .evaluate(async (el) => {
        (el as HTMLElement).click();
        await new Promise<void>((resolve) =>
          requestAnimationFrame(() => resolve()),
        );
        return Number(
          (
            document.querySelector(
              "#library-content .album-grid",
            ) as HTMLElement
          ).dataset.catalogTotal,
        );
      });
    expect(immediate).toBe(130);
    await page.waitForTimeout(250);
    await expect(page.locator("#library-content .album-grid")).toHaveAttribute(
      "data-catalog-total",
      "130",
    );
    expect(
      await page.locator("#library-content .album-card").count(),
    ).toBeLessThan(60);
    await expect(page.locator(".catalog-loading-label")).toHaveCount(0);
  }
});

test("import invalidates warmed tabs and includes the new album and artist", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await seedInlineCatalog(page);
  await page.waitForTimeout(2000);
  await page.getByRole("tab", { name: "Albums", exact: true }).click();
  await expect(page.locator("#library-content .album-grid")).toHaveAttribute(
    "data-catalog-total",
    "130",
  );
  expect(
    await page.locator("#library-content .album-card").count(),
  ).toBeLessThan(60);
  await page
    .locator("input[type=file]")
    .first()
    .setInputFiles({
      name: "warm-refresh.wav",
      mimeType: "audio/wav",
      buffer: taggedWav("Warm import", 9999, 1, {
        artist: "Fresh warm artist",
        album: "Fresh warm album",
      }),
    });
  await page.getByRole("tab", { name: "Albums", exact: true }).click();
  await expect(page.locator("#library-content .album-grid")).toHaveAttribute(
    "data-catalog-total",
    "131",
  );
  await expect(
    page
      .locator("#library-content .album-card strong")
      .filter({ hasText: "Fresh warm album" }),
  ).toHaveCount(1);
  await page.getByRole("tab", { name: "Artists", exact: true }).click();
  await expect(page.locator("#library-content .album-grid")).toHaveAttribute(
    "data-catalog-total",
    "131",
  );
  await expect(
    page
      .locator("#library-content .album-card strong")
      .filter({ hasText: "Fresh warm artist" }),
  ).toHaveCount(1);
});
