import { test, expect } from "@playwright/test";

test.use({ hasTouch: true, viewport: { width: 390, height: 844 } });
test("hold selection keeps row geometry and exposes circular controls with top and bottom actions", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Explore with sample audio" }).click();
  await expect(page.locator("#library-content .track-row")).toHaveCount(8);
  const row = page.locator("#library-content .track-row").first(),
    title = row.locator(".track-copy strong");
  const before = await title.boundingBox();
  await row.locator(".track-hit").dispatchEvent("pointerdown", {
    pointerType: "touch",
    pointerId: 4,
    isPrimary: true,
    clientX: 100,
    clientY: 300,
  });
  await expect(page.locator(".selection-heading")).toContainText("1 selected");
  await row.dispatchEvent("pointerup", {
    pointerType: "touch",
    pointerId: 4,
    isPrimary: true,
  });
  const after = await title.boundingBox();
  expect(Math.abs(after!.x - before!.x)).toBeLessThanOrEqual(1);
  expect(Math.abs(after!.y - before!.y)).toBeLessThanOrEqual(1);
  const marker = row.locator(".selection-check");
  await expect(marker).toHaveAttribute("aria-pressed", "true");
  await expect(marker.locator("svg")).toBeVisible();
  expect((await marker.boundingBox())!.width).toBeGreaterThanOrEqual(44);
  const header = (await page.locator(".selection-heading").boundingBox())!,
    actions = (await page.locator(".selection-actions").boundingBox())!;
  expect(header.y).toBeLessThan(30);
  expect(actions.y).toBeGreaterThan(600);
  expect(actions.y + actions.height).toBeLessThanOrEqual(844);
  await expect(page.locator(".selection-actions svg")).toHaveCount(5);
  await marker.click();
  await expect(page.locator(".selection-heading")).toContainText("0 selected");
  await page.keyboard.press("Escape");
  await expect(page.locator(".selection-toolbar")).toHaveCount(0);
  await expect(page.locator(".mini-player")).toHaveCount(0);
});

test("deliberate strip scrolling updates emphasis and interrupted settling cannot select later", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Explore with sample audio" }).click();
  await expect(page.locator("#library-content .track-row")).toHaveCount(8);
  const strip = page.locator(".section-tabs");
  await strip.dispatchEvent("pointerdown", {
    pointerType: "touch",
    pointerId: 7,
    isPrimary: true,
  });
  await strip.evaluate((el) => {
    el.scrollLeft = el.scrollWidth;
    el.dispatchEvent(new Event("scroll"));
  });
  await expect(page.locator("#tab-year")).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(page.locator(".mini-player")).toHaveCount(0);
  await strip.dispatchEvent("pointerdown", {
    pointerType: "touch",
    pointerId: 8,
    isPrimary: true,
  });
  await strip.evaluate((el) => {
    el.scrollLeft = 0;
    el.dispatchEvent(new Event("scroll"));
  });
  await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  await page.waitForTimeout(250);
  await expect(page.locator("#tab-year")).toHaveAttribute(
    "aria-selected",
    "true",
  );
});

test("selection header and action strip remain separated and reachable with enlarged text", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto("/");
  await page.getByRole("button", { name: "Explore with sample audio" }).click();
  await expect(page.locator("#library-content .track-row")).toHaveCount(8);
  await page
    .locator("#library-content .track-hit")
    .first()
    .dispatchEvent("pointerdown", {
      pointerType: "touch",
      pointerId: 9,
      isPrimary: true,
    });
  await expect(page.locator(".selection-heading")).toContainText("1 selected");
  await page
    .locator("#library-content .track-row")
    .first()
    .dispatchEvent("pointerup", {
      pointerType: "touch",
      pointerId: 9,
      isPrimary: true,
    });
  await page
    .locator(".selection-toolbar button,.selection-toolbar strong")
    .evaluateAll((els) => {
      const sizes = els.map((el) => parseFloat(getComputedStyle(el).fontSize));
      els.forEach(
        (el, i) => ((el as HTMLElement).style.fontSize = `${sizes[i] * 2}px`),
      );
    });
  await expect
    .poll(async () => {
      const header = (await page.locator(".selection-toolbar").boundingBox())!,
        tabs = (await page.locator(".section-tabs").boundingBox())!;
      return header.y + header.height - tabs.y;
    })
    .toBeLessThanOrEqual(1);
  for (const button of await page.locator(".selection-actions button").all())
    await expect(button).toBeInViewport({ ratio: 1 });
  await page
    .locator("#library-content .track-row")
    .last()
    .scrollIntoViewIfNeeded();
  const row = (await page
      .locator("#library-content .track-row")
      .last()
      .boundingBox())!,
    actions = (await page.locator(".selection-actions").boundingBox())!;
  expect(row.y + row.height).toBeLessThanOrEqual(actions.y + 1);
});
