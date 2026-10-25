import { test, expect } from "@playwright/test";
import { taggedWav } from "./fixtures";
import { openSettings, chooseSound } from "./navigationHelpers";

test("zoom-sized viewports retain readable player content, reachable controls and collection reflow", async ({
  page,
}) => {
  test.setTimeout(120000);
  await page.goto("/");
  await page
    .locator('input[type="file"]')
    .first()
    .setInputFiles({
      name: "Long title.wav",
      mimeType: "audio/wav",
      buffer: taggedWav(
        "The midnight orchestra and a very long live recording title",
        1,
        40,
      ),
    });
  await expect(page.locator(".track-row")).toHaveCount(1);
  await page.locator(".track-hit").first().click();
  await page
    .locator(".mini-player")
    .getByRole("button", { name: "Pause", exact: true })
    .click();
  for (const language of ["en", "es"]) {
    if (language === "es") {
      const settings = await openSettings(page);
      await settings
        .getByRole("button", { name: "Espa\u00f1ol", exact: true })
        .click();
      await settings
        .getByRole("button", { name: "Oscuro", exact: true })
        .click();
      await page.keyboard.press("Escape");
    }
    for (const size of [
      { width: 575, height: 373 },
      { width: 320, height: 240 },
      { width: 256, height: 200 },
    ]) {
      await page.setViewportSize(size);
      for (const section of [
        "songs",
        "albums",
        "artists",
        "playlists",
        "year",
      ]) {
        await page.locator(`#tab-${section}`).click();
        await page
          .locator("#library-content")
          .evaluate((node) =>
            Promise.all(
              node.getAnimations().map((a) => a.finished.catch(() => {})),
            ),
          );
        await expect
          .poll(() =>
            page.evaluate(
              () => document.documentElement.scrollWidth - innerWidth,
            ),
          )
          .toBeLessThanOrEqual(1);
      }
      await page.locator(".mini-track").click();
      const surface = page.locator(".player-surface");
      await expect(surface).toBeVisible();
      await expect
        .poll(() =>
          surface
            .locator(".player-cover")
            .evaluate((n) => n.getBoundingClientRect().width),
        )
        .toBeGreaterThanOrEqual(79);
      const art = (await surface.locator(".player-cover").boundingBox())!;
      expect(Math.abs(art.width - art.height)).toBeLessThanOrEqual(1);
      expect(art.width).toBeLessThanOrEqual(161);
      await expect
        .poll(() => surface.evaluate((n) => n.scrollWidth - n.clientWidth))
        .toBeLessThanOrEqual(1);
      for (const control of await surface
        .locator(
          ".player-track-actions > button, .transport > button, .progress input",
        )
        .all()) {
        await control.scrollIntoViewIfNeeded();
        await expect(control).toBeInViewport({ ratio: 0.99 });
      }
      const header = surface.locator(".player-surface-head");
      expect((await header.boundingBox())!.y).toBeGreaterThanOrEqual(-1);
      await page.screenshot({
        path: `artifacts/zoom-growth/reflow-${language}-${size.width}-${size.height}.png`,
      });
      await surface.locator("[data-player-menu]").click();
      const remove = page.getByRole("menuitem", {
        name:
          language === "en" ? "Remove from Library" : "Quitar de la biblioteca",
        exact: true,
      });
      await remove.scrollIntoViewIfNeeded();
      await expect(remove).toBeInViewport({ ratio: 0.99 });
      await page.keyboard.press("Escape");
      await page.setViewportSize({ width: 1280, height: 900 });
      await expect
        .poll(() =>
          surface
            .locator(".player-cover")
            .evaluate((n) => n.getBoundingClientRect().width),
        )
        .toBeGreaterThan(160);
      await expect
        .poll(() => surface.evaluate((n) => n.scrollHeight - n.clientHeight))
        .toBeLessThanOrEqual(2);
      await expect(surface.locator(".transport")).toBeInViewport({ ratio: 1 });
      await page.keyboard.press("Escape");
    }
    const settings = await openSettings(page);
    await page.setViewportSize({ width: 256, height: 200 });
    const close = settings.getByRole("button", {
      name: language === "en" ? "Close" : "Cerrar",
      exact: true,
    });
    await expect(close).toBeInViewport();
    await settings.locator(".settings-history").scrollIntoViewIfNeeded();
    await expect
      .poll(() => settings.evaluate((n) => n.scrollWidth - n.clientWidth))
      .toBeLessThanOrEqual(1);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.keyboard.press("Escape");
    await page.locator(".mini-track").click();
    await page.locator("[data-player-menu]").click();
    await page
      .getByRole("menuitem", {
        name: language === "en" ? "Sound options" : "Opciones de sonido",
        exact: true,
      })
      .click();
    await chooseSound(page, "equalizer");
    await page.setViewportSize({ width: 256, height: 200 });
    const dialog = page.getByRole("dialog");
    await expect
      .poll(() => dialog.evaluate((n) => n.scrollWidth - n.clientWidth))
      .toBeLessThanOrEqual(1);
    const bands = dialog.locator(".equalizer-band input");
    await bands.last().scrollIntoViewIfNeeded();
    await expect(bands.last()).toBeInViewport({ ratio: 0.8 });
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.keyboard.press("Escape");
    await page.keyboard.press("Escape");
    await page.keyboard.press("Escape");
  }
});
