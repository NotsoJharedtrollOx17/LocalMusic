import { test, expect, type Page } from "@playwright/test";
import { openSettings, openEqualizer } from "./navigationHelpers";
import { wav } from "./fixtures";
import { readFileSync } from "node:fs";
const { version } = JSON.parse(
  readFileSync(new URL("../../package.json", import.meta.url), "utf8"),
);
test.use({ hasTouch: true });
async function samples(page: Page) {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Explore with sample audio", exact: true })
    .click();
  await expect(page.locator("#library-content .track-row")).toHaveCount(8);
}
for (const width of [320, 390, 411])
  test(`phone header, album grid and transport fit ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 });
    await samples(page);
    await expect(page.locator(".page-footer")).toHaveCount(0);
    await expect(
      page
        .locator("#library-header-actions")
        .getByRole("button", { name: "Search your library", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Library actions", exact: true }),
    ).toHaveCount(1);
    await page.getByRole("tab", { name: "Albums", exact: true }).click();
    const cards = page.locator("#library-content .album-grid .album-card");
    await expect(cards.first()).toBeVisible();
    const first = await cards.nth(0).boundingBox(),
      second = await cards.nth(1).boundingBox();
    expect(Math.abs(first!.y - second!.y)).toBeLessThan(1);
    expect(second!.x).toBeGreaterThan(first!.x + first!.width);
    await page.getByRole("tab", { name: "Songs", exact: true }).click();
    await page.locator("#library-content .track-hit").first().click();
    const mini = page.locator(".mini-player");
    for (const name of ["Previous", "Pause", "Next"]) {
      const control = mini.getByRole("button", { name, exact: true });
      await expect(control).toBeInViewport();
      const box = await control.boundingBox();
      expect(box!.width).toBeGreaterThanOrEqual(48);
      expect(box!.height).toBeGreaterThanOrEqual(48);
    }
    expect(
      await mini.evaluate((el) =>
        parseFloat(getComputedStyle(el).borderRadius),
      ),
    ).toBe(12); // Compact mini-player corners, while controls keep 48px targets.
    await page.evaluate(() =>
      (
        document.querySelector<HTMLElement>(
          '.library-pane[data-active="true"]',
        ) ?? window
      ).scrollTo(0, 350),
    );
    const brand = await page.locator(".library-brand-header").boundingBox(),
      tabs = await page.locator(".library-navigation").boundingBox();
    expect(brand!.y).toBeGreaterThanOrEqual(-1);
    expect(tabs!.y).toBeGreaterThanOrEqual(brand!.y + brand!.height - 1);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth - innerWidth,
      ),
    ).toBeLessThanOrEqual(1);
  });

test("Android landscape keeps Library and mini-player controls outside side navigation", async ({
  page,
  context,
}) => {
  await page.setViewportSize({ width: 868, height: 411 });
  const cdp = await context.newCDPSession(page);
  await cdp.send("Emulation.setSafeAreaInsetsOverride", {
    insets: { top: 0, left: 0, bottom: 0, right: 48 },
  });
  await samples(page);
  await page.evaluate(() => {
    document.documentElement.dataset.platform = "android";
  });
  await page.locator("#library-content .track-hit").first().click();
  const mini = page.locator(".mini-player");
  await expect(mini).toHaveCSS("display", "flex");
  for (const control of [
    page.getByRole("button", { name: "Import music", exact: true }),
    page.getByRole("button", { name: "Library actions", exact: true }),
    page
      .locator("#library-content .track-row > button[aria-haspopup=menu]")
      .first(),
    mini.getByRole("button", { name: "Next", exact: true }),
  ]) {
    expect(
      (await control.boundingBox())!.x + (await control.boundingBox())!.width,
    ).toBeLessThanOrEqual(821);
  }
  const box = (await mini.boundingBox())!,
    close = (await mini
      .getByRole("button", { name: "Next", exact: true })
      .boundingBox())!;
  expect(box.x + box.width - close.x - close.width).toBeLessThan(12);
});

test("persistent player stays above Library content without interrupting playback", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    const play = HTMLMediaElement.prototype.play,
      pause = HTMLMediaElement.prototype.pause;
    (window as any).__pauseCalls = 0;
    HTMLMediaElement.prototype.play = function () {
      (window as any).__playingAudio = this;
      return play.call(this);
    };
    HTMLMediaElement.prototype.pause = function () {
      (window as any).__pauseCalls++;
      return pause.call(this);
    };
  });
  await samples(page);
  await page.locator("#library-content .track-hit").first().click();
  await expect
    .poll(() => page.evaluate(() => (window as any).__playingAudio?.paused))
    .toBe(false);
  const before = await page.evaluate(() => ({
    src: (window as any).__playingAudio.src,
    pauses: (window as any).__pauseCalls,
  }));
  await expect(page.locator(".mobile-mini-play button")).toHaveCount(3);
  await expect(
    page.getByRole("button", { name: "Hide mini-player", exact: true }),
  ).toHaveCount(0);
  for (const tab of ["Albums", "Artists", "Playlists", "Your Recap", "Songs"]) {
    await page.getByRole("tab", { name: tab, exact: true }).click();
    await page.evaluate(() =>
      (
        document.querySelector<HTMLElement>(
          '.library-pane[data-active="true"]',
        ) ?? window
      ).scrollTo(
        0,
        document.querySelector<HTMLElement>('.library-pane[data-active="true"]')
          ?.scrollHeight ?? document.documentElement.scrollHeight,
      ),
    );
    await expect(page.locator(".mini-player")).toBeInViewport();
  }
  expect(await page.evaluate(() => (window as any).__playingAudio.paused)).toBe(
    false,
  );
  expect(await page.evaluate(() => (window as any).__pauseCalls)).toBe(
    before.pauses,
  );
  expect(
    await page
      .locator(".mini-player-dock")
      .evaluate((el) => getComputedStyle(el).backgroundColor),
  ).not.toBe("rgba(0, 0, 0, 0)");
  await page
    .getByRole("button", { name: "Library actions", exact: true })
    .click();
  await page
    .getByRole("menuitem", { name: "Now playing", exact: true })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Now playing", exact: true }),
  ).toBeVisible();
  expect(await page.evaluate(() => (window as any).__playingAudio.src)).toBe(
    before.src,
  );
  await page.keyboard.press("Escape");
  await expect(page.locator(".mini-player")).toBeVisible();
});

test("touch highlights settle while keyboard focus remains visible", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await samples(page);
  const button = page.getByRole("button", {
    name: "Library actions",
    exact: true,
  });
  const box = (await button.boundingBox())!;
  await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
  const first = page.getByRole("menu").locator("button").first();
  await expect(first).toBeFocused();
  expect(
    await first.evaluate((el) => getComputedStyle(el, "::before").content),
  ).toBe("none");
  await page.keyboard.press("ArrowDown");
  expect(
    await page.evaluate(() => document.documentElement.dataset.input),
  ).toBe("keyboard");
  expect(
    await page
      .locator(".action-menu button:focus")
      .evaluate((el) => getComputedStyle(el, "::before").content),
  ).not.toBe("none");
});

test("Android player transitions never spawn a separate flying cover", async ({
  page,
}) => {
  await page.setViewportSize({ width: 411, height: 868 });
  await samples(page);
  await page.evaluate(() => {
    document.documentElement.dataset.platform = "android";
    (window as any).__flights = 0;
    new MutationObserver((records) =>
      records.forEach((record) =>
        record.addedNodes.forEach((node) => {
          if (node instanceof Element && node.matches(".cover-flight"))
            (window as any).__flights++;
        }),
      ),
    ).observe(document.body, { childList: true });
  });
  await page.locator("#library-content .track-hit").first().click();
  await page.locator(".mini-track").click();
  const player = page.getByRole("dialog", { name: "Now playing", exact: true });
  await expect(player).toBeVisible();
  await expect(player.locator(".player-surface-body")).toHaveCSS(
    "animation-name",
    "none",
  );
  await player.getByRole("button", { name: "Queue", exact: true }).click();
  const queue = page.getByRole("dialog", { name: "Queue", exact: true });
  await expect(queue.locator(".progress")).toContainText(":");
  await page.keyboard.press("Escape");
  await player.getByRole("button", { name: "Close", exact: true }).click();
  await expect(player).toHaveCount(0);
  expect(await page.evaluate(() => (window as any).__flights)).toBe(0);
});

test("phone EQ shows only usable bands with native presets", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    const Context = window.AudioContext;
    window.AudioContext = class extends Context {
      constructor(options?: AudioContextOptions) {
        super({ ...options, sampleRate: 16000 });
      }
    };
  });
  await samples(page);
  await page.locator("#library-content .track-hit").first().click();
  const eq = await openEqualizer(page),
    presets = eq.getByRole("combobox", { name: "Presets", exact: true });
  await expect(presets).toHaveValue("flat");
  await presets.selectOption("pop");
  await expect(presets).toHaveValue("pop");
  const band = eq.getByRole("slider", { name: "63 Hz gain", exact: true });
  await band.focus();
  await page.keyboard.press("End");
  await expect(presets).toHaveValue("custom");
  await expect(eq.getByRole("slider")).toHaveCount(7);
  await expect(
    eq.getByRole("slider", { name: "16000 Hz gain", exact: true }),
  ).toHaveCount(0);
  await expect(
    eq.getByRole("slider", { name: "8000 Hz gain", exact: true }),
  ).toHaveCount(0);
  await expect(eq.locator(".equalizer-inactive-note")).toBeHidden();
  await expect(eq.getByRole("slider", { name: "4000 Hz gain", exact: true })).toBeVisible();
  await expect(eq.locator(".equalizer-band small")).toHaveCount(0);
  await expect(eq.getByText(/^(Bass|Mids|Treble)$/)).toHaveCount(0);
});

test("mobile About returns to Settings and empty artist text spans the grid", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page
    .locator('input[type="file"]')
    .first()
    .setInputFiles({
      name: "Uncredited.wav",
      mimeType: "audio/wav",
      buffer: wav(12),
    });
  await expect(page.locator("#library-content .track-row")).toHaveCount(1);
  await page.getByRole("tab", { name: "Artists", exact: true }).click();
  const empty = page.locator("#library-content .album-grid .empty-small");
  await expect(empty).toBeVisible();
  await expect
    .poll(async () => {
      const rect = (await empty.boundingBox())!;
      const grid = (await page.locator("#library-content .album-grid").boundingBox())!;
      return Math.abs(rect.x + rect.width / 2 - (grid.x + grid.width / 2));
    })
    .toBeLessThanOrEqual(1);
  const rect = (await empty.boundingBox())!;
  const grid = (await page.locator("#library-content .album-grid").boundingBox())!;
  expect(Math.abs(rect.x + rect.width / 2 - (grid.x + grid.width / 2))).toBeLessThanOrEqual(1);
  const settings = await openSettings(page);
  await settings
    .getByRole("button", { name: "About Local Music", exact: true })
    .click();
  const about = page.getByRole("dialog", {
    name: "About Local Music",
    exact: true,
  });
  await expect(about).toContainText(version);
  await expect(page.getByRole("dialog")).toHaveCount(1);
  await page.keyboard.press("Escape");
  await expect(settings).toBeVisible();
  await expect(
    settings.getByRole("button", { name: "About Local Music", exact: true }),
  ).toBeFocused();
  await settings.getByRole("button", { name: "Español", exact: true }).click();
  await settings
    .getByRole("button", { name: "Acerca de Local Music", exact: true })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Acerca de Local Music", exact: true }),
  ).toContainText("Sin cuenta");
});
