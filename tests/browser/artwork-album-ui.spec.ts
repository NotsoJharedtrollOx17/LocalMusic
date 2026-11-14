import { test, expect } from "@playwright/test";
import { openSettings } from "./navigationHelpers";
test.use({ hasTouch: true });
async function samples(page: import("@playwright/test").Page, width = 390) {
  await page.setViewportSize({ width, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "Explore with sample audio" }).click();
  await expect(page.locator(".track-row")).toHaveCount(8);
}
test("phone artwork toggles the current song without restarting and never leaves stale hover controls", async ({
  page,
}) => {
  await samples(page);
  const rows = page.locator(".track-row"),
    first = rows.first();
  await first.locator(".track-hit").click();
  await expect(first).toHaveClass(/is-current/);
  await expect(first.locator(".cover-play")).toHaveCSS("opacity", "1");
  await expect
    .poll(() => page.locator(".mini-player input[type=range]").inputValue())
    .not.toBe("0");
  const position = Number(
    await page.locator(".mini-player input[type=range]").inputValue(),
  );
  await first.locator(".cover-wrap").click();
  await expect(first).not.toHaveClass(/is-playing/);
  expect(
    Number(await page.locator(".mini-player input[type=range]").inputValue()),
  ).toBeGreaterThanOrEqual(position);
  await first.locator(".cover-wrap").click();
  await expect(first).toHaveClass(/is-playing/);
  await rows.nth(1).locator(".track-hit").hover();
  await expect(rows.nth(1).locator(".cover-play")).toHaveCSS("opacity", "0");
  await rows.nth(1).locator(".track-hit").click();
  await expect(rows.nth(1)).toHaveClass(/is-current/);
  await expect(first.locator(".cover-play")).toHaveCSS("opacity", "0");
  await page.evaluate(() => scrollTo(0, 180));
  await expect(first.locator(".cover-play")).toHaveCSS("opacity", "0");
  await page.setViewportSize({ width: 1280, height: 900 });
  await first.locator(".track-hit").hover();
  await expect(first.locator(".cover-play")).toHaveCSS("opacity", "1");
});

test("phone album details use compact organization action, omit both totals and restore focus", async ({
  page,
}) => {
  await samples(page, 320);
  await page.getByRole("tab", { name: "Albums", exact: true }).click();
  await page.locator(".catalog-albums .album-card").first().click();
  const hero = page.locator(".collection-hero[data-kind=albums]"),
    action = hero.getByRole("button", {
      name: "Organize library",
      exact: true,
    });
  await expect(hero.locator(".collection-hero-count")).toBeHidden();
  await expect(
    page.locator(".library-toolbar[data-collection-kind=albums] > h2"),
  ).toBeHidden();
  const cover = (await hero.locator(".cover").boundingBox())!,
    title = (await hero.locator("h1").boundingBox())!;
  expect(title.x).toBeGreaterThan(cover.x + cover.width);
  await expect(action.locator("svg")).toBeVisible();
  await action.click();
  await expect(
    page.getByRole("dialog", { name: "Organize library", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(action).toBeFocused();
  await page.setViewportSize({ width: 1280, height: 900 });
  await expect(hero.locator(".collection-hero-count")).toBeVisible();
  await expect(
    page.locator(".library-toolbar[data-collection-kind=albums] > h2"),
  ).toBeVisible();
});
