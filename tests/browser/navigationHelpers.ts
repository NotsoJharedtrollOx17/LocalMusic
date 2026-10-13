import type { Page } from "@playwright/test";
export async function openSettings(page: Page) {
  await page
    .getByRole("button", {
      name: /^(Library actions|Acciones de la biblioteca)$/,
    })
    .click();
  await page.getByRole("menuitem", { name: /^(Settings|Ajustes)$/ }).click();
  return page.getByRole("dialog", { name: /^(Settings|Ajustes)$/ });
}
export async function openSound(
  page: Page,
  view: "equalizer" | "adapt" = "equalizer",
) {
  await page
    .getByRole("button", {
      name: /^(Library actions|Acciones de la biblioteca)$/,
    })
    .click();
  await page
    .getByRole("menuitem", { name: /^(Sound options|Opciones de sonido)$/ })
    .click();
  return chooseSound(page, view);
}
export async function chooseSound(page: Page, view: "equalizer" | "adapt") {
  const name =
    view === "equalizer" ? /^(Equalizer|Ecualizador)$/ : /^Adapt Sound$/;
  await page
    .getByRole("dialog", { name: /^(Sound options|Opciones de sonido)$/ })
    .getByRole("button", {
      name:
        view === "equalizer" ? /^(Equalizer|Ecualizador)\b/ : /^Adapt Sound\b/,
    })
    .click();
  return page.getByRole("dialog", { name });
}
export async function switchSound(page: Page, view: "equalizer" | "adapt") {
  await page.keyboard.press("Escape");
  return chooseSound(page, view);
}
export async function closeSound(page: Page) {
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
}
