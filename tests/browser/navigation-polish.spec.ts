import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import {
  openSettings,
  openEqualizer,
  closeEqualizer,
} from "./navigationHelpers";

test("compact Library menu opens EQ directly and keeps ordinary settings separate", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Explore with sample audio" }).click();
  await expect(page.locator(".track-row")).toHaveCount(8);
  await expect(page.locator(".library-page > .page-heading h1")).toHaveCount(0);
  await expect(
    page
      .locator(".library-toolbar")
      .getByRole("button", { name: "Filter and sort", exact: true }),
  ).toHaveCount(1);
  const menu = page.getByRole("button", {
    name: "Library actions",
    exact: true,
  });
  await menu.focus();
  await page.keyboard.press("Enter");
  await expect(menu).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByRole("menuitem")).toHaveText([
    "Edit",
    "Equalizer",
    "Settings",
  ]);
  await page.keyboard.press("Escape");
  await expect(menu).toBeFocused();
  await menu.click();
  await page.getByRole("menuitem", { name: "Edit", exact: true }).click();
  await expect(page.locator(".selection-toolbar")).toBeVisible();
  await page.keyboard.press("Escape");
  const eq = await openEqualizer(page);
  await expect(eq.getByRole("slider")).toHaveCount(9);
  await expect(
    eq.getByRole("button", { name: "Create personal profile", exact: true }),
  ).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(menu).toBeFocused();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const settings = await openSettings(page);
  for (const name of ["Language", "Theme", "Library", "Listening history"])
    await expect(
      settings.getByRole("group", { name, exact: true }),
    ).toBeVisible();
  await expect(settings).toContainText("Listening history");
  await expect(settings).not.toContainText("time zone");
  await expect(
    settings.getByRole("button", { name: "Equalizer", exact: true }),
  ).toHaveCount(0);
  await settings.getByRole("button", { name: "Dark", exact: true }).click();
  await settings
    .getByRole("button", { name: "Espa\u00f1ol", exact: true })
    .click();
  await page.keyboard.press("Escape");
  for (const width of [1280, 640, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(
      page.getByRole("button", {
        name: "Acciones de la biblioteca",
        exact: true,
      }),
    ).toBeInViewport();
    await expect(
      page.getByRole("button", {
        name: "Buscar en tu biblioteca",
        exact: true,
      }),
    ).toBeInViewport();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
    await page.screenshot({ path: `artifacts/navigation-polish-${width}.png` });
  }
  const spanish = await openSettings(page);
  await expect(spanish).toContainText("Tema");
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.keyboard.press("Escape");
  await openEqualizer(page);
  await closeEqualizer(page);
});
