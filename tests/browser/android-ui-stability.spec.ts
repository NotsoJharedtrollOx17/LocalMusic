import { test, expect, type Page } from "@playwright/test";
import { openEqualizer, openSettings } from "./navigationHelpers";

test.use({ hasTouch: true, viewport: { width: 390, height: 844 } });
const touch = (x = 120, y = 300) => ({
  pointerType: "touch",
  pointerId: 71,
  isPrimary: true,
  clientX: x,
  clientY: y,
});
async function samples(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Explore with sample audio" }).click();
  await expect(page.locator(".track-row")).toHaveCount(8);
}
async function player(page: Page) {
  await page.locator(".track-hit").first().click();
  await page
    .locator(".mini-player")
    .getByRole("button", { name: "Pause", exact: true })
    .click();
  await page.locator(".mini-track").click();
  return page.getByRole("dialog", { name: "Now playing", exact: true });
}

test("Queue has inline accessible actions and preserves editing/current-song restrictions at phone widths", async ({
  page,
}) => {
  await samples(page);
  const full = await player(page);
  await full.getByRole("button", { name: "Queue", exact: true }).click();
  const queue = page.getByRole("dialog", { name: "Queue", exact: true });
  const rows = queue.locator(".track-row");
  await expect(rows).toHaveCount(8);
  await expect(queue.locator(".album-label")).toHaveCount(0);
  for (const width of [320, 390, 411]) {
    await page.setViewportSize({ width, height: 844 });
    const title = (await rows.first().locator(".track-hit").boundingBox())!;
    const controls = await rows.first().locator(".row-actions button").all();
    for (const button of controls) {
      const bounds = (await button.boundingBox())!;
      expect(bounds.width).toBeGreaterThanOrEqual(48);
      expect(bounds.height).toBeGreaterThanOrEqual(48);
      expect(
        Math.abs(bounds.y + bounds.height / 2 - title.y - title.height / 2),
      ).toBeLessThan(2);
      expect(bounds.x).toBeGreaterThanOrEqual(title.x + title.width - 1);
    }
    expect(
      await queue.evaluate((el) => el.scrollWidth - el.clientWidth),
    ).toBeLessThanOrEqual(1);
  }
  await expect(
    rows.first().getByRole("button", { name: "Remove", exact: true }),
  ).toBeDisabled();
  const second = await rows.nth(1).locator(".track-copy strong").innerText();
  await rows
    .nth(1)
    .getByRole("button", { name: "Move up", exact: true })
    .click();
  await expect(rows.first().locator(".track-copy strong")).toHaveText(second);
  await rows
    .first()
    .getByRole("button", { name: "Remove", exact: true })
    .click();
  await expect(rows).toHaveCount(7);
});

test("touch menus open neutral, highlight only a press and retain keyboard navigation", async ({
  page,
}) => {
  await samples(page);
  const full = await player(page);
  await full.getByRole("button", { name: "Player options", exact: true }).tap();
  const menu = page.getByRole("menu");
  const artist = menu.getByRole("menuitem", {
    name: "Go to artist",
    exact: true,
  });
  const neutral = await artist.evaluate(
    (el) => getComputedStyle(el).backgroundColor,
  );
  await artist.hover(); // Simulate WebView's compatibility hover after touch.
  expect(
    await artist.evaluate((el) => getComputedStyle(el).backgroundColor),
  ).toBe(neutral);
  await artist.dispatchEvent("pointerdown", touch());
  await expect(artist).toHaveAttribute("data-touch-pressed", "true");
  expect(
    await artist.evaluate((el) => getComputedStyle(el).backgroundColor),
  ).not.toBe(neutral);
  await artist.dispatchEvent("pointercancel", touch());
  await expect(artist).not.toHaveAttribute("data-touch-pressed");
  await page.keyboard.press("ArrowDown");
  expect(await menu.evaluate((el) => el.contains(document.activeElement))).toBe(
    true,
  );
  expect(
    await page.evaluate(() => document.documentElement.dataset.input),
  ).toBe("keyboard");
  await page.keyboard.press("Escape");
  await expect(
    full.getByRole("button", { name: "Player options", exact: true }),
  ).toBeFocused();
});

test("EQ centers usable controls but remains scrollable in a short viewport", async ({
  page,
}) => {
  await samples(page);
  const eq = await openEqualizer(page);
  const controls = eq.locator(".sound-controls");
  await expect(controls).toBeVisible();
  const body = (await eq.locator(".modal-body").boundingBox())!,
    box = (await controls.boundingBox())!;
  expect(
    Math.abs(body.y + body.height / 2 - box.y - box.height / 2),
  ).toBeLessThan(3);
  await page.setViewportSize({ width: 390, height: 360 });
  await controls.locator('input[type="range"]').last().scrollIntoViewIfNeeded();
  await expect(controls.locator('input[type="range"]').last()).toBeInViewport();
  await expect(
    eq.getByRole("button", { name: "Close", exact: true }),
  ).toBeInViewport();
});

test("Visualizer modes share one segmented row with Spanish large labels and About credits its creator", async ({
  page,
}) => {
  await samples(page);
  const settings = await openSettings(page);
  await settings.getByRole("button", { name: "Español", exact: true }).click();
  await settings
    .getByRole("button", { name: "Acerca de Local Music", exact: true })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Acerca de Local Music", exact: true }),
  ).toContainText("Creado por Abraham Jhared Flores Azcona");
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  await page.locator(".track-hit").first().click();
  await page.locator(".mini-track").click();
  await page.locator("[data-player-menu]").click();
  await page
    .getByRole("menuitem", { name: "Visualizador", exact: true })
    .click();
  await page.setViewportSize({ width: 320, height: 640 });
  const modes = page.locator(".visualizer-modes button");
  await expect(modes).toHaveCount(3);
  await modes.evaluateAll((els) =>
    els.forEach((el) => {
      (el as HTMLElement).style.fontSize = "26px";
    }),
  );
  const bounds = await modes.evaluateAll((els) =>
    els.map((el) => ({
      y: el.getBoundingClientRect().y,
      w: el.getBoundingClientRect().width,
    })),
  );
  expect(new Set(bounds.map((b) => b.y)).size).toBe(1);
  expect(
    Math.max(...bounds.map((b) => b.w)) - Math.min(...bounds.map((b) => b.w)),
  ).toBeLessThan(1);
  for (const mode of await modes.all()) {
    await mode.click();
    await expect(mode).toHaveAttribute("aria-pressed", "true");
  }
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - innerWidth,
    ),
  ).toBeLessThanOrEqual(1);
});

test("a held tab-strip drag cannot select early or settle after a newer navigation", async ({
  page,
}) => {
  await samples(page);
  const strip = page.locator(".section-tabs");
  await strip.dispatchEvent("pointerdown", touch());
  await strip.dispatchEvent("touchstart");
  await strip.evaluate((el) => {
    el.scrollLeft = el.scrollWidth;
    el.dispatchEvent(new Event("scroll"));
  });
  await page.waitForTimeout(220); // Exceed the settling timer while the finger is held.
  await expect(page.locator("#tab-songs")).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await strip.dispatchEvent("touchend");
  await expect(page.locator("#tab-year")).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await strip.dispatchEvent("pointerdown", touch());
  await strip.dispatchEvent("touchstart");
  await strip.evaluate((el) => {
    el.scrollLeft = 0;
    el.dispatchEvent(new Event("scroll"));
  });
  await page.locator("#tab-playlists").click();
  await strip.dispatchEvent("touchend");
  await page.waitForTimeout(220);
  await expect(page.locator("#tab-playlists")).toHaveAttribute(
    "aria-selected",
    "true",
  );
});

test("dragging cards clears touch feedback and rapid swipe replacement leaves one content animation", async ({
  page,
}) => {
  await samples(page);
  await page.locator("#tab-artists").click();
  const card = page.locator(".catalog-artists .album-card").first();
  await card.dispatchEvent("pointerdown", touch(200));
  await expect(card).toHaveAttribute("data-touch-pressed", "true");
  await card.dispatchEvent("pointermove", touch(160));
  await expect(card).not.toHaveAttribute("data-touch-pressed");
  await card.dispatchEvent("pointercancel", touch(160));
  const panel = page.locator(".library-page");
  for (const [start, end] of [
    [300, 265],
    [300, 80],
    [100, 300],
    [300, 80],
  ]) {
    await panel.dispatchEvent("pointerdown", touch(start));
    await panel.dispatchEvent("pointermove", touch(end));
    await panel.dispatchEvent("pointerup", touch(end));
    expect(
      await page
        .locator("#library-content")
        .evaluate(
          (el) =>
            el.getAnimations().filter((a) => a.playState !== "finished").length,
        ),
    ).toBeLessThanOrEqual(1);
  }
  await page.locator("#tab-artists").click();
  await page.locator(".catalog-artists .album-card").first().tap();
  await expect(page.locator(".collection-hero")).toBeVisible();
  await expect(page.locator("[data-touch-pressed]")).toHaveCount(0);
});
