import { expect, type Page } from "@playwright/test";
export async function openSettings(page: Page) {
  await page
    .getByRole("button", {
      name: /^(Library actions|Acciones de la biblioteca)$/,
    })
    .click();
  await page.getByRole("menuitem", { name: /^(Settings|Ajustes)$/ }).click();
  return page.getByRole("dialog", { name: /^(Settings|Ajustes)$/ });
}
export async function equalizerDialog(page: Page) {
  const dialog = page.getByRole("dialog", {
    name: /^(Equalizer|Ecualizador)$/,
  });
  await expect(dialog).toBeVisible();
  return dialog;
}
export async function openEqualizer(page: Page) {
  await page
    .getByRole("button", {
      name: /^(Library actions|Acciones de la biblioteca)$/,
    })
    .click();
  await page
    .getByRole("menuitem", { name: /^(Equalizer|Ecualizador)$/ })
    .click();
  return equalizerDialog(page);
}
export async function closeEqualizer(page: Page) {
  await page.keyboard.press("Escape");
}
