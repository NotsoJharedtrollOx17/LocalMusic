import { test, expect, type Locator, type Page } from "@playwright/test";
import { openSettings } from "./navigationHelpers";

async function frame(page: Page, control: Locator) {
  await page.keyboard.press("Shift");
  await control.focus();
  await page.evaluate(() =>
    Promise.all(
      document
        .getAnimations()
        .filter(
          (animation) =>
            animation.effect?.getComputedTiming().iterations !== Infinity,
        )
        .map((animation) => animation.finished.catch(() => {})),
    ),
  );
  const before = await control.boundingBox();
  const style = await control.evaluate((node) => {
    const ring = getComputedStyle(node, "::before");
    return {
      visible: node.matches(":focus-visible"),
      radius: ring.borderRadius,
      width: ring.borderTopWidth,
      color: ring.borderTopColor,
      fill: ring.backgroundColor,
      animation: ring.animationName,
      inset: ring.top,
      outline: getComputedStyle(node).outlineStyle,
      halo: ring.boxShadow,
      forced: matchMedia("(forced-colors: active)").matches,
    };
  });
  expect(style).toMatchObject({
    visible: true,
    radius: "8px",
    width: "2px",
    fill: "rgba(0, 0, 0, 0)",
    animation: "none",
    outline: "none",
  });
  if (!style.forced) {
    expect(style.halo).not.toBe("none");
    const luminance = (color: string) => {
      const rgb = color
        .match(/\d+(?:\.\d+)?/g)!
        .slice(0, 3)
        .map(Number)
        .map((v) => v / 255)
        .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
      return rgb.reduce(
        (sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i],
        0,
      );
    };
    const stroke = luminance(style.color),
      edge = luminance(style.halo);
    expect(
      (Math.max(stroke, edge) + 0.05) / (Math.min(stroke, edge) + 0.05),
    ).toBeGreaterThanOrEqual(3);
  }
  const after = await control.boundingBox();
  for (const axis of ["x", "y", "width", "height"] as const)
    expect(Math.abs(after![axis] - before![axis])).toBeLessThanOrEqual(1);
  return style;
}

test("keyboard frames stay rounded across buttons, menus, themes and forced colors", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Explore with sample audio" }).click();
  await expect(page.getByText("8 songs", { exact: true })).toBeVisible();
  for (const width of [1280, 320]) {
    await page.setViewportSize({ width, height: 800 });
    await page.getByRole("tab", { name: "Playlists", exact: true }).click();
    const selectedTab = page.getByRole("tab", {
      name: "Playlists",
      exact: true,
    });
    await selectedTab.focus();
    await page.keyboard.press("Tab");
    const search = page.getByRole("button", {
      name: "Search your library",
      exact: true,
    });
    await expect(search).toBeFocused();
    await frame(page, search);
    await page.keyboard.press("Shift+Tab");
    await expect(selectedTab).toBeFocused();
    await frame(page, selectedTab);
    await frame(
      page,
      page.getByRole("button", { name: "Balanced", exact: true }),
    );
    await expect(
      page.getByRole("button", { name: "Balanced", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    const opener = page.getByRole("button", {
      name: "Library actions",
      exact: true,
    });
    await frame(page, opener);
    await page.keyboard.press("Enter");
    const menu = page.getByRole("menu");
    await page.keyboard.press("ArrowDown");
    const selected = menu.locator("button:focus");
    const menuFrame = await frame(page, selected);
    expect(menuFrame.inset).toBe("2px");
    await page.keyboard.press("Escape");
    await expect(opener).toBeFocused();
    const settings = await openSettings(page);
    for (const theme of ["Dark", "Light"]) {
      const choice = settings.getByRole("button", { name: theme, exact: true });
      await choice.click();
      await frame(page, choice);
      await expect(choice).toHaveAttribute("aria-pressed", "true");
    }
    await page.emulateMedia({
      reducedMotion: "reduce",
      forcedColors: "active",
    });
    await frame(
      page,
      settings.getByRole("button", { name: "Light", exact: true }),
    );
    await page.emulateMedia({
      reducedMotion: "no-preference",
      forcedColors: "none",
    });
    await settings.getByRole("button", { name: "Close", exact: true }).click();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await page.getByRole("tab", { name: "Songs", exact: true }).click();
  await page.locator(".track-row .track-hit").first().click();
  await page.locator(".mini-track").click();
  const player = page.getByRole("dialog", { name: "Now playing", exact: true });
  await frame(page, player.locator(".play-circle"));
  await frame(
    page,
    player.getByRole("button", { name: "Favorite", exact: true }),
  );
  await page.screenshot({
    path: "artifacts/focus-rounded-player.png",
    fullPage: true,
  });
  await page.keyboard.press("Escape");
  const settings = await openSettings(page);
  await settings
    .getByRole("button", { name: "Espa\u00f1ol", exact: true })
    .click();
  await frame(
    page,
    settings.getByRole("button", { name: "Oscuro", exact: true }),
  );
  await settings.getByRole("button", { name: "Cerrar", exact: true }).click();
  await page.screenshot({
    path: "artifacts/focus-rounded-mobile.png",
    fullPage: true,
  });
});

test("library frames enclose covers and text, with orange outline-only icon hover", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Explore with sample audio" }).click();
  await expect(page.getByText("8 songs", { exact: true })).toBeVisible();
  for (const width of [1280, 320]) {
    await page.setViewportSize({ width, height: 800 });
    for (const theme of ["light", "dark"]) {
      await page.evaluate(
        (theme) => (document.documentElement.dataset.theme = theme),
        theme,
      );
      for (const tab of ["Songs", "Albums", "Artists"]) {
        await page.getByRole("tab", { name: tab, exact: true }).click();
        const entry = page
          .locator(tab === "Songs" ? ".track-hit" : ".album-card")
          .first();
        await entry.scrollIntoViewIfNeeded();
        const style = await frame(page, entry);
        expect(style.color).toBe(
          theme === "light" ? "rgb(184, 68, 11)" : "rgb(255, 153, 93)",
        );
        const geometry = await entry.evaluate((node) => {
          const box = node.getBoundingClientRect(),
            ring = getComputedStyle(node, "::before");
          return {
            width: box.width,
            height: box.height,
            ringWidth: parseFloat(ring.width),
            ringHeight: parseFloat(ring.height),
            border: parseFloat(ring.borderTopWidth),
            children: [...node.children].map((child) => {
              const r = child.getBoundingClientRect();
              return {
                left: r.left - box.left,
                top: r.top - box.top,
                right: box.right - r.right,
                bottom: box.bottom - r.bottom,
              };
            }),
          };
        });
        expect(
          Math.abs(geometry.ringWidth + 2 * geometry.border - geometry.width),
        ).toBeLessThanOrEqual(1);
        expect(
          Math.abs(geometry.ringHeight + 2 * geometry.border - geometry.height),
        ).toBeLessThanOrEqual(1);
        for (const child of geometry.children)
          for (const gap of Object.values(child))
            expect(gap).toBeGreaterThanOrEqual(5);
        await page.screenshot({
          path: `artifacts/focus-${tab.toLowerCase()}-${theme}-${width}.png`,
          fullPage: true,
        });
      }
      const icon = page.getByRole("button", {
        name: "Library actions",
        exact: true,
      });
      await icon.hover();
      const hover = await icon.evaluate((node) => ({
        background: getComputedStyle(node).backgroundColor,
        radius: getComputedStyle(node, "::before").borderRadius,
        color: getComputedStyle(node, "::before").borderTopColor,
      }));
      expect(hover.background).toBe("rgba(0, 0, 0, 0)");
      expect(hover.radius).toBe("8px");
      expect(hover.color).toBe(
        theme === "light" ? "rgb(184, 68, 11)" : "rgb(255, 153, 93)",
      );
    }
  }
});
