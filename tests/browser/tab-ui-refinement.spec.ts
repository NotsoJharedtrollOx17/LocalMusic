import { test, expect, type Page } from "@playwright/test";
import { seedInlineCatalog } from "./inlineSearchFixture";
import { openSettings } from "./navigationHelpers";

async function samples(page: Page) {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "Explore with sample audio" }).click();
  await expect(page.locator(".track-row")).toHaveCount(8);
  await page.evaluate(() => document.fonts.ready);
}

test("visible tab selection preserves strip position and every label's geometry", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await samples(page);
  const strip = page.locator(".section-tabs");
  await strip.evaluate((el) => {
    el.scrollLeft = 25;
  });
  const geometry = () =>
    strip.locator("button").evaluateAll((els) =>
      els.map((el) => ({
        left: (el as HTMLElement).offsetLeft,
        width: (el as HTMLElement).offsetWidth,
      })),
    );
  const before = await geometry(),
    left = await strip.evaluate((el) => el.scrollLeft);
  await page.getByRole("tab", { name: "Artists", exact: true }).click();
  await expect(
    page.getByRole("tab", { name: "Artists", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  expect(await geometry()).toEqual(before);
  expect(await strip.evaluate((el) => el.scrollLeft)).toBeCloseTo(left, 0);
  // Moving the strip itself must not choose a different collection.
  await strip.evaluate((el) => {
    el.scrollLeft = el.scrollWidth;
  });
  await expect(page.getByRole("tab", { selected: true })).toHaveText("Artists");
  await page.getByRole("tab", { name: "Your Recap", exact: true }).click();
  const selected = await page
      .getByRole("tab", { selected: true })
      .boundingBox(),
    bounds = (await strip.boundingBox())!;
  expect(selected!.x).toBeGreaterThanOrEqual(bounds.x - 1);
  expect(selected!.x + selected!.width).toBeLessThanOrEqual(
    bounds.x + bounds.width + 1,
  );
  await page.setViewportSize({ width: 320, height: 844 });
  // Native scroll offsets round to pixels; allow a subpixel edge difference.
  await expect
    .poll(async () => {
      const selected = (await page
        .getByRole("tab", { selected: true })
        .boundingBox())!;
      const viewport = (await strip.boundingBox())!;
      return Math.max(
        viewport.x - selected.x,
        selected.x + selected.width - viewport.x - viewport.width,
      );
    })
    .toBeLessThanOrEqual(1);
});

test("keyboard tab focus never changes the Library's vertical scroll", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await seedInlineCatalog(page);
  await page.evaluate(() => window.scrollTo({ top: 260, behavior: "instant" }));
  const before = await page.evaluate(() => scrollY);
  expect(before).toBeGreaterThan(200);
  await page
    .getByRole("tab", { name: "Songs", exact: true })
    .evaluate((el) => (el as HTMLElement).focus({ preventScroll: true }));
  await page.keyboard.press("ArrowRight");
  await expect(
    page.getByRole("tab", { name: "Albums", exact: true }),
  ).toBeFocused();
  expect(await page.evaluate(() => scrollY)).toBeCloseTo(before, 0);
  await page.keyboard.press("End");
  await expect(
    page.getByRole("tab", { name: "Your Recap", exact: true }),
  ).toBeInViewport();
  expect(await page.evaluate(() => scrollY)).toBeCloseTo(before, 0);
  await expect(page.getByRole("tab", { selected: true })).toHaveText("Songs");
});

test("Spanish dark tabs retain their geometry at 320px with doubled text", async ({
  page,
}) => {
  await samples(page);
  const settings = await openSettings(page);
  await settings.getByRole("button", { name: "Español", exact: true }).click();
  await settings.getByRole("button", { name: "Oscuro", exact: true }).click();
  await page.keyboard.press("Escape");
  await page.setViewportSize({ width: 320, height: 640 });
  const strip = page.locator(".section-tabs");
  await strip.locator("button").evaluateAll((els) =>
    els.forEach((el) => {
      (el as HTMLElement).style.fontSize =
        `${parseFloat(getComputedStyle(el).fontSize) * 2}px`;
    }),
  );
  const geometry = () =>
    strip.locator("button").evaluateAll((els) =>
      els.map((el) => ({
        left: (el as HTMLElement).offsetLeft,
        width: (el as HTMLElement).offsetWidth,
      })),
    );
  const before = await geometry();
  await page.getByRole("tab", { name: "Álbumes", exact: true }).click();
  await expect(
    page.getByRole("tab", { name: "Álbumes", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  expect(await geometry()).toEqual(before);
  await expect
    .poll(async () => {
      const selected = (await page
          .getByRole("tab", { selected: true })
          .boundingBox())!,
        indicator = (await page.locator(".section-indicator").boundingBox())!;
      return Math.max(
        Math.abs(selected.x - indicator.x),
        Math.abs(selected.width - indicator.width),
      );
    })
    .toBeLessThanOrEqual(1);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - innerWidth,
    ),
  ).toBeLessThanOrEqual(1);
});

test("phone Songs keep title and artist while collection and desktop metadata remain available", async ({
  page,
}) => {
  await samples(page);
  const row = page.locator(".track-row").first();
  await expect(row.locator(".track-copy strong")).toBeVisible();
  await expect(row.locator(".track-artist")).toBeVisible();
  await expect(row.locator(".track-duration-inline")).toBeHidden();
  await expect(row.locator(".album-label")).toBeHidden();
  await expect(
    row.getByRole("button", { name: "Favorite", exact: true }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "Albums", exact: true }).click();
  await page.locator(".album-card").first().click();
  await expect(
    page.locator(".track-row .track-duration-inline").first(),
  ).toBeVisible();
  await page.getByRole("button", { name: "Library", exact: true }).click();
  await page.getByRole("tab", { name: "Songs", exact: true }).click();
  await page.setViewportSize({ width: 1280, height: 800 });
  await expect(row.locator(".album-label")).toBeVisible();
  await expect(row.locator(":scope > .track-duration")).toBeVisible();
});

test("phone Artists are full-width rows while Albums and desktop Artists retain cards", async ({
  page,
}) => {
  await samples(page);
  await page.getByRole("tab", { name: "Artists", exact: true }).click();
  const cards = page.locator(".album-card");
  await expect(cards.nth(1)).toBeVisible();
  const first = (await cards.nth(0).boundingBox())!,
    second = (await cards.nth(1).boundingBox())!;
  expect(second.y).toBeGreaterThanOrEqual(first.y + first.height - 1);
  expect(first.width).toBeGreaterThan(340);
  const image = (await cards.first().locator(".cover").boundingBox())!;
  expect(image.width).toBe(44);
  expect(image.height).toBe(44);
  await cards.first().click();
  await expect(page.locator(".collection-hero h1")).toBeVisible();
  await page.getByRole("button", { name: "Library", exact: true }).click();
  await page.getByRole("tab", { name: "Albums", exact: true }).click();
  const a = (await cards.nth(0).boundingBox())!,
    b = (await cards.nth(1).boundingBox())!;
  expect(Math.abs(a.y - b.y)).toBeLessThan(1);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.getByRole("tab", { name: "Artists", exact: true }).click();
  expect(
    Math.abs(
      (await cards.nth(0).boundingBox())!.y -
        (await cards.nth(1).boundingBox())!.y,
    ),
  ).toBeLessThan(1);
});

test("Android player opens without a fade or mini-player progress sliver", async ({
  page,
}) => {
  await samples(page);
  await page.evaluate(() => {
    document.documentElement.dataset.platform = "android";
  });
  await page.locator(".track-hit").first().click();
  await page
    .locator(".mobile-mini-play")
    .getByRole("button", { name: "Pause", exact: true })
    .click();
  await expect(page.locator(".mini-progress")).toHaveCount(0);
  await page.locator(".mini-track").click();
  const player = page.getByRole("dialog", { name: "Now playing", exact: true });
  await expect(player).toBeVisible();
  await expect(player).toHaveCSS("animation-name", "phone-player-reveal");
  await expect(player.locator(".player-cover")).toBeVisible();
  await expect(player.locator(".progress input")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(player).toHaveCount(0);
  await expect(page.locator(".cover-flight")).toHaveCount(0);
});
