import { settleUI } from "./settleUI";
import { test, expect, type Page, type Locator } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { en, es } from "../../src/i18n";
import { openSettings } from "./navigationHelpers";

async function inspect(page: Page, scope: Locator = page.locator("body")) {
  await settleUI(page);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - innerWidth,
    ),
  ).toBeLessThanOrEqual(1);
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations.map((v) => ({
      id: v.id,
      nodes: v.nodes.map((n) => n.target),
    })),
  ).toEqual([]);
  await scope.getByRole("button").first().focus();
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press("Tab");
    expect(
      await scope.evaluate(
        (node) =>
          node.contains(document.activeElement) &&
          !document.activeElement?.closest("[inert]"),
      ),
    ).toBe(true);
  }
}

for (const config of [
  {
    name: "desktop-en-light",
    width: 1280,
    height: 800,
    spanish: false,
    dark: false,
    reduced: false,
  },
  {
    name: "phone-es-dark",
    width: 390,
    height: 844,
    spanish: true,
    dark: true,
    reduced: false,
  },
  {
    name: "narrow-en-reduced",
    width: 320,
    height: 640,
    spanish: false,
    dark: false,
    reduced: true,
  },
  {
    name: "landscape-es-dark",
    width: 640,
    height: 360,
    spanish: true,
    dark: true,
    reduced: false,
  },
])
  test(`cross-view keyboard and layout stress: ${config.name}`, async ({
    page,
  }) => {
    test.setTimeout(180_000);
    await page.setViewportSize({ width: config.width, height: config.height });
    await page.emulateMedia({
      reducedMotion: config.reduced ? "reduce" : "no-preference",
    });
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/");
    await page.getByRole("button", { name: en.sample, exact: true }).click();
    await expect(page.locator("#library-content .track-row")).toHaveCount(8);
    let settings = await openSettings(page);
    if (config.dark)
      await settings
        .getByRole("button", { name: en.dark, exact: true })
        .click();
    if (config.spanish)
      await settings
        .getByRole("button", { name: "Español", exact: true })
        .click();
    const t = config.spanish ? es : en;
    settings = page.getByRole("dialog", { name: t.settings, exact: true });
    await inspect(page, settings);
    await page.screenshot({
      path: `artifacts/ui-audit-${config.name}-settings.png`,
    });
    await page.keyboard.press("Escape");
    for (let loop = 0; loop < 2; loop++)
      for (const tab of [t.albums, t.artists, t.playlists, t.year, t.songs]) {
        await page.getByRole("tab", { name: tab, exact: true }).click();
        await expect(
          page.getByRole("tab", { name: tab, exact: true }),
        ).toHaveAttribute("aria-selected", "true");
      }
    await inspect(page);
    await page.getByRole("tab", { name: t.playlists, exact: true }).click();
    await page
      .getByRole("button", { name: t.newPlaylist, exact: true })
      .click();
    const manual = page.getByRole("dialog", {
      name: t.newPlaylist,
      exact: true,
    });
    await manual
      .getByLabel(t.playlistName, { exact: true })
      .fill("Small screen draft");
    await manual.getByRole("checkbox").first().check();
    await inspect(page, manual);
    await manual
      .getByRole("button", { name: t.save, exact: true })
      .scrollIntoViewIfNeeded();
    await page.screenshot({
      path: `artifacts/ui-audit-${config.name}-manual.png`,
    });
    await page.keyboard.press("Escape");
    await page.getByRole("tab", { name: t.songs, exact: true }).click();
    await page
      .locator("#library-content .track-row")
      .first()
      .locator(".track-copy")
      .click();
    await page.locator(".mini-track").click();
    let player = page.getByRole("dialog", { name: t.nowPlaying, exact: true });
    await expect(player).toBeVisible();
    await inspect(page, player);
    await page.screenshot({
      path: `artifacts/ui-audit-${config.name}-player.png`,
    });
    await player.getByRole("button", { name: t.queue, exact: true }).click();
    const queue = page.getByRole("dialog", { name: t.queue, exact: true });
    await inspect(page, queue);
    await page.keyboard.press("Escape");
    player = page.getByRole("dialog", { name: t.nowPlaying, exact: true });
    await expect(player).toBeVisible();
    await player
      .getByRole("button", { name: t.playerOptions, exact: true })
      .click();
    await page
      .getByRole("menuitem", { name: t.equalizer, exact: true })
      .click();
    const eq = page.getByRole("dialog", { name: t.equalizer, exact: true });
    await expect(eq).toBeVisible();
    await inspect(page, eq);
    await eq.getByRole("slider").first().focus();
    expect(
      await eq
        .getByRole("slider")
        .first()
        .evaluate((node) => {
          const style = getComputedStyle(node);
          const probe = document.createElement("span");
          probe.style.color = "var(--focus-stroke)";
          // Inputs are replaced elements: descendants have no computed style.
          document.body.appendChild(probe);
          const expected = getComputedStyle(probe).color;
          probe.remove();
          return (
            style.outlineColor === expected &&
            parseFloat(style.borderRadius) >= 7
          );
        }),
    ).toBe(true);
    await page.screenshot({ path: `artifacts/ui-audit-${config.name}-eq.png` });
    await page.keyboard.press("Escape");
    await expect(player).toBeVisible();
    await player
      .getByRole("button", { name: t.playerOptions, exact: true })
      .click();
    await page
      .getByRole("menuitem", { name: t.visualizer, exact: true })
      .click();
    const visual = page.getByRole("dialog", {
      name: t.visualizer,
      exact: true,
    });
    await expect(visual).toBeVisible();
    for (const mode of [t.geometry, t.xmb, t.spectrum])
      await visual.getByRole("button", { name: mode, exact: true }).click();
    await inspect(page, visual);
    await page.screenshot({
      path: `artifacts/ui-audit-${config.name}-visualizer.png`,
    });
    await page.keyboard.press("Escape");
    await expect(player).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(player).toHaveCount(0);
    expect(errors).toEqual([]);
  });
