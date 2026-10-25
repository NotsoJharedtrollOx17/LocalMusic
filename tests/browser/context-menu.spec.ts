import { test, expect } from "@playwright/test";

test("song menus are compact, scoped and equivalent across pointer and keyboard", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Explore with sample audio" }).click();
  const row = page.locator(".track-row").first();
  const opener = row.getByRole("button", { name: /^Track actions:/ });
  const menu = page.getByRole("menu");
  const expected = [
    "Add to playlist",
    "Track details",
    "Go to album",
    "Go to artist",
    "Remove from Library",
  ];
  await opener.click();
  await expect(opener).toHaveAttribute("aria-expanded", "true");
  await expect(menu.getByRole("menuitem")).toHaveText(expected);
  await page.keyboard.press("Escape");
  await expect(opener).toBeFocused();
  await expect(opener).toHaveAttribute("aria-expanded", "false");
  await row.click({ button: "right" });
  await expect(menu.getByRole("menuitem")).toHaveText(expected);
  await page.keyboard.press("Escape");
  await row.locator(".track-hit").focus();
  await page.keyboard.press("Shift+F10");
  await expect(menu.getByRole("menuitem")).toHaveText(expected);
  await page.keyboard.press("End");
  await expect(
    menu.getByRole("menuitem", { name: "Remove from Library", exact: true }),
  ).toBeFocused();
  await page.evaluate(() => window.__musicBack?.());
  await expect(row.locator(".track-hit")).toBeFocused();
  await row.getByRole("button", { name: "Favorite", exact: true }).click();
  await expect(
    row.getByRole("button", { name: "Favorite", exact: true }),
  ).toHaveClass(/active/);
  await row.locator(".track-hit").click();
  await expect(page.locator(".mini-player")).toBeVisible();
  await page
    .locator(".mini-center")
    .getByRole("button", { name: "Pause", exact: true })
    .click();
  await page.setViewportSize({ width: 390, height: 700 });
  await row.evaluate((el) =>
    el.dispatchEvent(
      new MouseEvent("contextmenu", {
        bubbles: true,
        cancelable: true,
        clientX: 387,
        clientY: 695,
      }),
    ),
  );
  await expect(menu).toBeVisible();
  const box = (await menu.boundingBox())!;
  expect(box.x + box.width).toBeLessThanOrEqual(390);
  expect(box.y + box.height).toBeLessThanOrEqual(700);
  await page.screenshot({ path: "artifacts/context-menu-mobile.png" });
  await page.keyboard.press("Escape");
  await page.evaluate(() => {
    Object.defineProperty(navigator, "canShare", {
      configurable: true,
      value: () => true,
    });
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: async () => {
        document.body.dataset.shareChooser = "opened";
      },
    });
  });
  await opener.click();
  await menu
    .getByRole("menuitem", { name: "Share audio", exact: true })
    .click();
  await expect(page.locator("body")).toHaveAttribute(
    "data-share-chooser",
    "opened",
  );
});

test("backgrounds and cards no longer expose redundant navigation", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Explore with sample audio" }).click();
  for (const tab of ["Songs", "Albums", "Artists", "Playlists", "Your Year"]) {
    await page.getByRole("tab", { name: tab, exact: true }).click();
    const canceled = await page
      .locator(".library-page")
      .evaluate(
        (el) =>
          !el.dispatchEvent(
            new MouseEvent("contextmenu", { bubbles: true, cancelable: true }),
          ),
      );
    expect(canceled).toBe(true);
    await expect(page.getByRole("menu")).toHaveCount(0);
    if (tab === "Albums" || tab === "Artists") {
      const card = page.locator(".album-card").first();
      await expect(card).toBeVisible();
      await card.click({ button: "right" });
      await expect(page.getByRole("menu")).toHaveCount(0);
      await expect(page.locator(".collection-hero")).toHaveCount(0);
    }
    if (tab !== "Songs") {
      await page
        .getByRole("button", { name: "Library actions", exact: true })
        .click();
      await expect(page.getByRole("menuitem")).toHaveText([
        "Equalizer",
        "Settings",
      ]);
      await page.keyboard.press("Escape");
    }
  }
  await page.getByRole("tab", { name: "Albums", exact: true }).click();
  const card = page.locator(".album-card").first();
  const title = await card.locator("strong").textContent();
  await card.focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("heading", { name: title!, exact: true }),
  ).toHaveCount(1);
});

test("menus switch owners, dismiss without playback and hand focus to their destination", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Explore with sample audio" }).click();
  const row = page.locator(".track-row").first();
  const opener = row.getByRole("button", { name: /^Track actions:/ });
  const header = page.getByRole("button", {
    name: "Library actions",
    exact: true,
  });
  await header.click();
  await opener.click();
  await expect(page.getByRole("menu")).toHaveCount(1);
  await expect(
    page.getByRole("menuitem", { name: "Track details", exact: true }),
  ).toBeVisible();
  await row.locator(".track-hit").click();
  await expect(page.getByRole("menu")).toHaveCount(0);
  await expect(page.locator(".mini-player")).toHaveCount(0);
  await opener.click();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("menu")).toHaveCount(0);
  await expect(opener).not.toBeFocused();
  await opener.click();
  await page
    .getByRole("menuitem", { name: "Track details", exact: true })
    .click();
  const dialog = page.getByRole("dialog", {
    name: "Track details",
    exact: true,
  });
  await expect(dialog).toBeVisible();
  expect(
    await dialog.evaluate((el) => el.contains(document.activeElement)),
  ).toBe(true);
  await page.keyboard.press("Escape");
  await expect(opener).toBeFocused();
  await opener.click();
  await page
    .getByRole("menuitem", { name: "Add to playlist", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(1);
  await page.keyboard.press("Escape");
  await expect(opener).toBeFocused();
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
