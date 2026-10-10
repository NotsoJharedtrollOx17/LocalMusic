import { test, expect } from "@playwright/test";

test("styled context menus retain track actions, keyboard focus and edge placement", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Explore with sample audio" }).click();
  const row = page.locator(".track-row").first();
  await row.click({ button: "right" });
  const trackMenu = page.getByRole("menu");
  await expect(
    trackMenu.getByRole("menuitem", { name: "Play", exact: true }),
  ).toBeVisible();
  await expect(
    trackMenu.getByRole("menuitem", {
      name: "Remove from Library",
      exact: true,
    }),
  ).toBeVisible();
  await trackMenu
    .getByRole("menuitem", { name: "Favorite", exact: true })
    .click();
  await expect(
    row.getByRole("button", { name: "Favorite", exact: true }),
  ).toHaveClass(/active/);
  await expect(trackMenu).toHaveCount(0);
  await row.locator(".track-hit").focus();
  await page.keyboard.press("Shift+F10");
  await expect(trackMenu).toBeVisible();
  await page.keyboard.press("End");
  await expect(
    trackMenu.getByRole("menuitem", {
      name: "Remove from Library",
      exact: true,
    }),
  ).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(row.locator(".track-hit")).toBeFocused();
  await page.locator(".heading-actions svg").first().click({ button: "right" });
  await expect(page.getByRole("menu", { name: "App actions" })).toBeVisible();
  await page.keyboard.press("Escape");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() =>
    document.querySelector(".app-shell")!.dispatchEvent(
      new MouseEvent("contextmenu", {
        bubbles: true,
        cancelable: true,
        clientX: 387,
        clientY: 840,
      }),
    ),
  );
  const menu = page.getByRole("menu", { name: "App actions" });
  await expect(menu).toBeVisible();
  const box = await menu.boundingBox();
  expect(box!.x + box!.width).toBeLessThanOrEqual(390);
  expect(box!.y + box!.height).toBeLessThanOrEqual(844);
  await page.screenshot({ path: "artifacts/context-menu-mobile.png" });
  await menu.getByRole("menuitem", { name: "Search your library" }).click();
  await expect(page.getByRole("searchbox")).toBeFocused();
  await page.keyboard.press("Escape");
  await page.getByRole("tab", { name: "Albums", exact: true }).click();
  const card = page.locator(".album-card").first();
  const title = await card.locator("strong").textContent();
  await card.click({ button: "right" });
  await expect(
    page.getByRole("menuitem", { name: "Open", exact: true }),
  ).toBeVisible();
  await page.getByRole("menuitem", { name: "Open", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: title!, exact: true }).first(),
  ).toBeVisible();
});

test("custom editor menus preserve React values and clipboard failures", async ({
  page,
}) => {
  await page.addInitScript(() => {
    let clipboard = "rain";
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async (text: string) => {
          clipboard = text;
        },
        readText: async () => clipboard,
      },
    });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Explore with sample audio" }).click();
  await page.getByRole("button", { name: "Search your library" }).click();
  const input = page.getByRole("searchbox");
  await input.fill("Blue after");
  const open = async () =>
    input.evaluate((el: HTMLInputElement) => {
      el.setSelectionRange(0, el.value.length);
      el.dispatchEvent(
        new MouseEvent("contextmenu", {
          bubbles: true,
          cancelable: true,
          clientX: 500,
          clientY: 70,
        }),
      );
    });
  await open();
  await page.getByRole("menuitem", { name: "Copy", exact: true }).click();
  await expect(input).toBeFocused();
  await open();
  await page.getByRole("menuitem", { name: "Cut", exact: true }).click();
  await expect(input).toHaveValue("");
  await open();
  await page.getByRole("menuitem", { name: "Paste", exact: true }).click();
  await expect(input).toHaveValue("Blue after");
  await expect(page.locator(".search-results .track-copy strong")).toHaveText(
    "Blue after rain",
  );
  await open();
  await page
    .getByRole("menuitem", { name: "Select all text", exact: true })
    .click();
  expect(
    await input.evaluate((el: HTMLInputElement) =>
      el.value.slice(el.selectionStart!, el.selectionEnd!),
    ),
  ).toBe("Blue after");
  await page.evaluate(() => {
    navigator.clipboard.readText = async () => {
      throw new Error("Denied");
    };
  });
  await open();
  await page.getByRole("menuitem", { name: "Paste", exact: true }).click();
  await expect(
    page.getByText(
      "Clipboard access is unavailable. Use the keyboard copy/paste shortcuts.",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(input).toHaveValue("Blue after");
});
