import { taggedWav } from "./fixtures";
import { test, expect } from "@playwright/test";
import { seedInlineCatalog } from "./inlineSearchFixture";
test("startup warms complete group catalogs without hidden cards and revisits retain every entry", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await seedInlineCatalog(page);
  // Give scheduled background batches time while the user stays in Songs.
  await page.waitForTimeout(2000);
  await expect(page.locator(".album-card")).toHaveCount(0);
  for (const name of ["Albums", "Artists", "Albums"]) {
    const immediate = await page
      .getByRole("tab", { name, exact: true })
      .evaluate(async (el) => {
        (el as HTMLElement).click();
        await new Promise<void>((resolve) =>
          requestAnimationFrame(() => resolve()),
        );
        return document.querySelectorAll(".album-card").length;
      });
    expect(immediate).toBe(130);
    await page.waitForTimeout(250);
    await expect(page.locator(".album-card")).toHaveCount(130);
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
  await expect(page.locator(".album-card")).toHaveCount(130);
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
  await expect(page.locator(".album-card")).toHaveCount(131);
  await expect(
    page.locator(".album-card strong").filter({ hasText: "Fresh warm album" }),
  ).toHaveCount(1);
  await page.getByRole("tab", { name: "Artists", exact: true }).click();
  await expect(page.locator(".album-card")).toHaveCount(131);
  await expect(
    page.locator(".album-card strong").filter({ hasText: "Fresh warm artist" }),
  ).toHaveCount(1);
});
