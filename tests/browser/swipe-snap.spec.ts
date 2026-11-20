import { test, expect } from "@playwright/test";
test.use({ hasTouch: true, viewport: { width: 390, height: 844 } });
async function setup(page: import("@playwright/test").Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Explore with sample audio" }).click();
  await expect(page.locator("#library-content .track-row")).toHaveCount(8);
}
const point = (x: number, y = 350) => ({
  pointerType: "touch",
  pointerId: 72,
  isPrimary: true,
  clientX: x,
  clientY: y,
});

test("finger jitter stays still and a short flick cannot activate a song or page", async ({ page }) => {
  await setup(page);
  const hit = page.locator("#library-content .track-hit").first();
  const track = page.locator(".library-pager-track");
  await hit.dispatchEvent("pointerdown", point(220));
  await hit.dispatchEvent("pointermove", point(214));
  await expect(track).toHaveCSS("transform", "none");
  await hit.dispatchEvent("pointermove", point(195));
  await hit.dispatchEvent("pointerup", point(195));
  await hit.dispatchEvent("click", { detail: 1 });
  await expect(page.locator("#tab-songs")).toHaveAttribute("aria-selected", "true");
  await expect(page.locator(".mini-player")).toHaveCount(0);
  await hit.tap();
  await expect(page.locator(".mini-player")).toBeVisible();
});
test("small horizontal drags expose the page background and snap back without changing tabs", async ({
  page,
}) => {
  await setup(page);
  const panel = page.locator(".library-page"),
    content = page.locator(".library-pager-track"),
    tabs = page.locator(".section-tabs");
  const before = (await content.boundingBox())!,
    header = (await tabs.boundingBox())!;
  await panel.dispatchEvent("pointerdown", point(300));
  await panel.dispatchEvent("pointermove", point(265));
  const dragged = (await content.boundingBox())!;
  expect(dragged.x).toBeLessThan(before.x - 12);
  expect(dragged.x).toBeGreaterThan(before.x - 40);
  expect((await tabs.boundingBox())!.x).toBe(header.x);
  await expect(panel).toHaveCSS("transform", "none");
  await page.screenshot({
    path: "artifacts/android-swipe-snap/small-left-drag.png",
  });
  await page.waitForTimeout(160); // Short deliberate drag, below the fling velocity threshold.
  await panel.dispatchEvent("pointerup", point(265));
  await expect(content).toHaveCSS("transform", "none");
  await expect(page.locator("#tab-songs")).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await panel.dispatchEvent("pointerdown", point(180));
  await panel.dispatchEvent("pointermove", point(215));
  expect((await content.boundingBox())!.x).toBeGreaterThan(before.x + 4);
  await panel.dispatchEvent("pointercancel", point(215));
  await expect(content).toHaveCSS("transform", "none");
  await expect(page.locator("#tab-songs")).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(page.locator(".mini-player")).toHaveCount(0);
});
test("interrupted drags clear their offset and Reduce Motion suppresses drag and settling movement", async ({
  page,
}) => {
  await setup(page);
  const panel = page.locator(".library-page"),
    content = page.locator(".library-pager-track");
  await panel.dispatchEvent("pointerdown", point(300));
  await panel.dispatchEvent("pointermove", point(260));
  expect(
    await content.evaluate(
      (el) => new DOMMatrixReadOnly(getComputedStyle(el).transform).m41,
    ),
  ).toBeLessThan(0);
  await page.evaluate(() => dispatchEvent(new Event("blur")));
  await expect(content).toHaveCSS("transform", "none");
  await panel.dispatchEvent("pointerup", point(80));
  await expect(page.locator("#tab-songs")).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await page.emulateMedia({ reducedMotion: "reduce" });
  await panel.dispatchEvent("pointerdown", point(300));
  await panel.dispatchEvent("pointermove", point(80));
  await expect(content).toHaveCSS("transform", "none");
  await panel.dispatchEvent("pointerup", point(80));
  await expect(page.locator("#tab-albums")).toHaveAttribute(
    "aria-selected",
    "true",
  );
  expect(await content.evaluate((el) => el.getAnimations().length)).toBe(0);
});
