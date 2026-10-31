import { test, expect } from "@playwright/test";
import { DetachedFixture } from "./detached-window-fixture";
test("browser preview keeps existing in-app views without desktop controls", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("tab", { name: "Songs", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Open in separate window" }),
  ).toHaveCount(0);
});
test("detached player handoff, Queue, pin, shared playback and deferred return", async ({
  page,
  context,
}) => {
  const f = new DetachedFixture(context);
  await f.attach(page);
  await page.goto("/");
  await page.locator(".mini-track").click();
  await page
    .getByRole("button", { name: "Open in separate window", exact: true })
    .click();
  await expect.poll(() => f.windows[0]?.phase).toBe("detached");
  const child = f.children.get("player")!;
  await expect(child.locator(".standalone-player")).toBeVisible();
  await expect(child.locator(".library-page,.mini-player")).toHaveCount(0);
  await expect(page.locator(".player-scrim:visible")).toHaveCount(0);
  await child
    .getByRole("button", { name: "Always on top", exact: true })
    .click();
  await expect.poll(() => f.windows[0]?.pinned).toBe(true);
  await child.getByRole("button", { name: "Play", exact: true }).click();
  await expect(
    page
      .locator(".mini-player")
      .getByRole("button", { name: "Pause", exact: true }),
  ).toBeVisible();
  await child.getByRole("button", { name: "Favorite", exact: true }).click();
  await expect.poll(() => f.tracks[0].favorite).toBe(true);
  await expect(
    page
      .locator(".track-row")
      .getByRole("button", { name: "Favorite", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.locator(".mini-track").click();
  expect(f.children.size).toBe(1);
  await child.getByRole("button", { name: "Queue", exact: true }).click();
  await expect(
    child.getByRole("dialog", { name: "Queue", exact: true }),
  ).toBeVisible();
  await child.keyboard.press("Escape");
  await expect(
    child.getByRole("dialog", { name: "Now playing", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Library actions", exact: true })
    .click();
  await page.getByRole("menuitem", { name: "Settings", exact: true }).click();
  await child
    .getByRole("button", { name: "Return to main window", exact: true })
    .click();
  await expect.poll(() => f.windows.length).toBe(0);
  await expect(
    page.getByRole("dialog", { name: "Settings", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("dialog", { name: "Now playing", exact: true }),
  ).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("dialog", { name: "Now playing", exact: true }),
  ).toBeVisible();
  expect(f.calls.some((c) => c.startsWith("player:list_groups"))).toBe(false);
  expect(f.calls.some((c) => c.startsWith("player:get_recap"))).toBe(false);
  expect(f.calls.some((c) => c.startsWith("player:analysis_activity"))).toBe(
    false,
  );
});
test("creation failure retains the source player and permits retry", async ({
  page,
  context,
}) => {
  const f = new DetachedFixture(context);
  await f.attach(page);
  await page.goto("/");
  await page.locator(".mini-track").click();
  f.failOpen = true;
  await page
    .getByRole("button", { name: "Open in separate window", exact: true })
    .click();
  await expect(page.locator(".error-banner")).toContainText(
    "Simulated window creation failure",
  );
  await expect(
    page.getByRole("dialog", { name: "Now playing", exact: true }),
  ).toBeVisible();
  f.failOpen = false;
  await page
    .locator(".error-banner")
    .getByRole("button", { name: "Try again", exact: true })
    .click();
  await expect.poll(() => f.windows[0]?.phase).toBe("detached");
});

test("two detached views synchronize language/mode and return in order behind Settings", async ({
  page,
  context,
}) => {
  const f = new DetachedFixture(context);
  await f.attach(page);
  await page.goto("/");
  await page.locator(".mini-track").click();
  await page
    .getByRole("button", { name: "Open in separate window", exact: true })
    .click();
  await expect.poll(() => f.windows[0]?.phase).toBe("detached");
  const player = f.children.get("player")!;
  await player
    .getByRole("button", { name: "Player options", exact: true })
    .click();
  await player
    .getByRole("menuitem", { name: "Visualizer", exact: true })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Visualizer", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Open in separate window", exact: true })
    .click();
  await expect
    .poll(() => f.windows.filter((e) => e.phase === "detached").length)
    .toBe(2);
  const visualizer = f.children.get("visualizer")!;
  await player.evaluate(() =>
    (window as any).__TAURI_INTERNALS__.invoke("patch_settings", {
      patch: { language: "es" },
    }),
  );
  await visualizer.evaluate(() =>
    (window as any).__TAURI_INTERNALS__.invoke("patch_settings", {
      patch: { visualizerMode: "geometry", theme: "dark" },
    }),
  );
  await expect(
    player.getByRole("dialog", { name: "Reproduciendo", exact: true }),
  ).toBeVisible();
  await expect(
    visualizer.getByRole("button", { name: "Geometría", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await player.setViewportSize({ width: 360, height: 480 });
  await visualizer.setViewportSize({ width: 360, height: 480 });
  for (const p of [player, visualizer])
    expect(
      await p.evaluate(() => document.documentElement.scrollWidth - innerWidth),
    ).toBeLessThanOrEqual(1);
  await page
    .getByRole("button", { name: "Acciones de la biblioteca", exact: true })
    .click();
  await page.getByRole("menuitem", { name: "Ajustes", exact: true }).click();
  await visualizer
    .getByRole("button", { name: "Volver a la ventana principal", exact: true })
    .click();
  await player
    .getByRole("button", { name: "Volver a la ventana principal", exact: true })
    .click();
  await expect.poll(() => f.windows.length).toBe(0);
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("dialog", { name: "Visualizador", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("dialog", { name: "Reproduciendo", exact: true }),
  ).toBeVisible();
});
