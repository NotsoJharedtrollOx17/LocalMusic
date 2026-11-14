import { test, expect, type Page, type CDPSession } from "@playwright/test";
import { wav } from "./fixtures";
import { holdNextTrackRead, release } from "./catalog-gate";
import { openSettings } from "./navigationHelpers";

test.use({ hasTouch: true });
async function uncredited(page: Page) {
  await page.goto("/");
  await page
    .locator("input[type=file]")
    .first()
    .setInputFiles({
      name: "Uncredited.wav",
      mimeType: "audio/wav",
      buffer: wav(12),
    });
  await expect(page.locator(".track-row")).toHaveCount(1);
}
async function swipe(cdp: CDPSession, y: number, from = 320, to = 70) {
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: from, y }],
  });
  for (let i = 1; i <= 6; i++)
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: from + ((to - from) * i) / 6, y }],
    });
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
}

test("real touch swipes cover empty viewport, header and gutters without starting playback", async ({
  page,
  context,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await uncredited(page);
  const cdp = await context.newCDPSession(page);
  for (const [target, y] of [
    ["Albums", 700],
    ["Artists", 700],
    ["Playlists", 30],
    ["Your Recap", 700],
  ] as const) {
    await swipe(cdp, y);
    await expect(
      page.getByRole("tab", { name: target, exact: true }),
    ).toHaveAttribute("aria-selected", "true");
    await expect(page.locator(".content-shell")).toHaveCSS("transform", "none");
    await expect(page.locator("#library-content")).toHaveCSS("opacity", "1");
  }
  await swipe(cdp, 650, 5, 270);
  await expect(
    page.getByRole("tab", { name: "Playlists", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await expect(page.locator(".mini-player")).toHaveCount(0);
  // Native tab-strip scrolling owns its own horizontal movement.
  const tab = page.getByRole("tab", { name: "Playlists", exact: true }),
    box = (await tab.boundingBox())!;
  await swipe(cdp, box.y + box.height / 2, 300, 80);
  await expect(tab).toHaveAttribute("aria-selected", "true");
});

test("empty Albums and Artists retain confirmed state without placeholder flashes", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await uncredited(page);
  await page.evaluate(() => {
    (window as any).__placeholders = 0;
    new MutationObserver((rs) =>
      rs.forEach((r) =>
        r.addedNodes.forEach((n) => {
          if (n instanceof Element)
            (window as any).__placeholders += n.matches(".album-placeholder")
              ? 1
              : n.querySelectorAll(".album-placeholder").length;
        }),
      ),
    ).observe(document.body, { childList: true, subtree: true });
  });
  await holdNextTrackRead(page);
  await page.getByRole("tab", { name: "Albums", exact: true }).click();
  await expect(
    page.getByRole("status", { name: "Loading albums…", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".album-placeholder")).toHaveCount(0);
  await release(page);
  await expect(page.locator(".album-grid > .empty-small")).toBeVisible();
  await page.getByRole("tab", { name: "Artists", exact: true }).click();
  await expect(page.locator(".album-grid > .empty-small")).toBeVisible();
  await holdNextTrackRead(page);
  await page.getByRole("tab", { name: "Albums", exact: true }).click();
  await expect(page.locator(".album-grid")).toHaveAttribute(
    "aria-busy",
    "true",
  );
  await expect(page.locator(".album-grid > .empty-small")).toBeVisible();
  await expect(page.locator(".catalog-loading-label")).toHaveCount(0);
  await release(page);
  expect(await page.evaluate(() => (window as any).__placeholders)).toBe(0);
});

test("Favorites, search and New playlist reflow with larger EN/ES phone text", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page
    .getByRole("button", { name: "Explore with sample audio", exact: true })
    .click();
  for (const es of [false, true]) {
    if (es) {
      const settings = await openSettings(page);
      await settings
        .getByRole("button", { name: "Español", exact: true })
        .click();
      await page.keyboard.press("Escape");
    }
    for (const width of [320, 390, 411]) {
      await page.setViewportSize({ width, height: 844 });
      await page
        .getByRole("tab", { name: es ? "Canciones" : "Songs", exact: true })
        .click();
      await page
        .getByRole("button", {
          name: es ? "Filtrar y ordenar" : "Filter and sort",
          exact: true,
        })
        .click();
      await page
        .getByRole("menuitemradio", {
          name: es ? "Favoritas" : "Favorites",
          exact: true,
        })
        .click();
      // A text-size proxy; physical testing separately preserves the user's actual scale.
      await page.addStyleTag({
        content:
          ".collection-count{font-size:20.8px!important}.collection-count-prefix{font-size:15.6px!important}",
      });
      const check = async () => {
        const heading = (await page
            .locator(".collection-count")
            .boundingBox())!,
          actions = (await page.locator(".toolbar-actions").boundingBox())!;
        expect(
          heading.x + heading.width <= actions.x + 1 ||
            heading.y + heading.height <= actions.y + 1,
        ).toBe(true);
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth - innerWidth,
          ),
        ).toBeLessThanOrEqual(1);
      };
      await check();
      await page
        .getByRole("button", {
          name: es ? "Buscar en tu biblioteca" : "Search your library",
          exact: true,
        })
        .click();
      await page.locator(".inline-search input").fill("orbit");
      await expect(page.locator("[data-search-clear]")).toBeVisible();
      await check();
      await page.keyboard.press("Escape");
      await page.keyboard.press("Escape");
      await page
        .getByRole("tab", { name: es ? "Listas" : "Playlists", exact: true })
        .click();
      const button = page.getByRole("button", {
          name: es ? "Nueva lista" : "New playlist",
          exact: true,
        }),
        box = (await button.boundingBox())!;
      expect(box.width).toBeLessThan(200);
      expect(box.height).toBeGreaterThanOrEqual(48);
      const title = (await page.locator(".collection-count").boundingBox())!;
      expect(title.y + title.height).toBeLessThanOrEqual(
        box.y + box.height + 1,
      );
      await button.click();
      await expect(page.getByRole("dialog")).toHaveCount(1);
      await expect(
        page
          .getByRole("dialog")
          .getByRole("button", { name: es ? "Guardar" : "Save", exact: true }),
      ).toBeVisible();
      await page.keyboard.press("Escape");
    }
  }
});

test("Android player header swipe dismisses without stretching its surface", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await uncredited(page);
  await page.evaluate(() => {
    document.documentElement.dataset.platform = "android";
  });
  await page.locator(".track-hit").click();
  await page.locator(".mini-track").click();
  const player = page.getByRole("dialog", { name: "Now playing", exact: true }),
    head = player.locator(".player-surface-head");
  const pointer = (y: number) => ({
    pointerType: "touch",
    pointerId: 9,
    clientX: 190,
    clientY: y,
  });
  await head.dispatchEvent("pointerdown", pointer(30));
  await head.dispatchEvent("pointermove", pointer(100));
  await expect(player).toHaveCSS("transform", "none");
  await head.dispatchEvent("pointercancel", pointer(100));
  await expect(player).toBeVisible();
  await head.dispatchEvent("pointerdown", pointer(30));
  await head.dispatchEvent("pointermove", pointer(180));
  await head.dispatchEvent("pointerup", pointer(180));
  await expect(player).toHaveCount(0);
  await expect(page.locator(".mini-player")).toBeInViewport();
});

test("real touch landscape swipes retain phone navigation through empty views and both margins", async ({
  page,
  context,
}) => {
  await page.setViewportSize({ width: 868, height: 411 });
  await uncredited(page);
  await page.evaluate(() => {
    document.documentElement.dataset.platform = "android";
  });
  await page.getByRole("tab", { name: "Albums", exact: true }).click();
  await page.getByRole("tab", { name: "Songs", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-layout", "phone");
  const cdp = await context.newCDPSession(page);
  for (const target of ["Albums", "Artists"]) {
    await swipe(cdp, 350, 760, 120);
    await expect(
      page.getByRole("tab", { name: target, exact: true }),
    ).toHaveAttribute("aria-selected", "true");
  }
  await swipe(cdp, 350, 5, 320);
  await expect(
    page.getByRole("tab", { name: "Albums", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await swipe(cdp, 350, 863, 500);
  await expect(
    page.getByRole("tab", { name: "Artists", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await expect(page.locator(".mini-player")).toHaveCount(0);
});

test("leaving long-press selection does not swallow the next real touch menu tap", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await uncredited(page);
  const hit = page.locator(".track-hit").first();
  await hit.dispatchEvent("pointerdown", {
    isPrimary: true,
    pointerType: "touch",
    pointerId: 17,
    clientX: 90,
    clientY: 230,
  });
  await expect(page.locator(".selection-toolbar")).toBeVisible();
  await hit.dispatchEvent("pointerup", { pointerType: "touch", pointerId: 17 });
  await page.keyboard.press("Escape");
  await expect(page.locator(".selection-toolbar")).toHaveCount(0);
  const action = page.getByRole("button", {
      name: "Library actions",
      exact: true,
    }),
    box = (await action.boundingBox())!;
  await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
  await expect(
    page.getByRole("menuitem", { name: "Equalizer", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator(".mini-player")).toHaveCount(0);
});
