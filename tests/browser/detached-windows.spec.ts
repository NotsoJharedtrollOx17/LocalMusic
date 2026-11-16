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
      .locator("#library-content .track-row")
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
  await expect(page.locator(".visualizer-view")).toHaveCount(0);
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

test("Now Playing opens Visualizer directly in a separate window, keeping the popup usable on failure", async ({
  page,
  context,
}) => {
  const f = new DetachedFixture(context);
  await f.attach(page);
  await page.goto("/");
  await page.locator(".mini-track").click();
  f.failOpen = true;
  await page
    .getByRole("button", { name: "Player options", exact: true })
    .click();
  await page.getByRole("menuitem", { name: "Visualizer", exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: "Now playing", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".visualizer-view")).toHaveCount(0);
  f.failOpen = false;
  await page
    .locator(".error-banner")
    .getByRole("button", { name: "Try again", exact: true })
    .click();
  await expect
    .poll(() => f.windows.find((e) => e.view === "visualizer")?.phase)
    .toBe("detached");
  await expect(
    f.children
      .get("visualizer")!
      .getByRole("dialog", { name: "Visualizer", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("dialog", { name: "Now playing", exact: true }),
  ).toBeVisible();
  expect(f.calls.some((c) => c === "main:start_visualizer")).toBe(false);
  await page
    .getByRole("button", { name: "Player options", exact: true })
    .click();
  await page.getByRole("menuitem", { name: "Visualizer", exact: true }).click();
  expect(f.children.size).toBe(1);
});
test("detached content grows and shrinks with the window within readable bounds", async ({
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
  await expect
    .poll(() => f.windows.filter((e) => e.phase === "detached").length)
    .toBe(2);
  const visualizer = f.children.get("visualizer")!;
  const samples = [];
  for (const size of [
    { width: 360, height: 480 },
    { width: 720, height: 860 },
    { width: 1440, height: 1080 },
  ]) {
    await player.setViewportSize(size);
    await visualizer.setViewportSize(size);
    await player.evaluate(
      () =>
        new Promise((r) =>
          requestAnimationFrame(() => requestAnimationFrame(r)),
        ),
    );
    if (size.width === 360) {
      const layout = await player.evaluate(() => {
        const head = document.querySelector(".player-surface-head")!;
        const title = head.querySelector("h2")!.getBoundingClientRect();
        const buttons = [...head.querySelectorAll("button")].map((b) =>
          b.getBoundingClientRect(),
        );
        return {
          title: { left: title.left, right: title.right },
          buttons: buttons.map((b) => ({
            top: b.top,
            left: b.left,
            right: b.right,
          })),
        };
      });
      expect(
        Math.max(...layout.buttons.map((b) => b.top)) -
          Math.min(...layout.buttons.map((b) => b.top)),
      ).toBeLessThanOrEqual(1);
      expect(layout.buttons[0].right).toBeLessThanOrEqual(
        layout.title.left + 1,
      );
      expect(layout.title.right).toBeLessThanOrEqual(
        layout.buttons[1].left + 1,
      );
      await player.screenshot({
        path: "artifacts/detached-window-back/player-compact-final.png",
      });
    }
    const metrics = await player.evaluate(() => {
      const art = document
          .querySelector(".player-cover")!
          .getBoundingClientRect(),
        title = document.querySelector(".player-title h2")!,
        artist = document.querySelector(".player-title p")!;
      return {
        art: art.width,
        artHeight: art.height,
        title: parseFloat(getComputedStyle(title).fontSize),
        artist: parseFloat(getComputedStyle(artist).fontSize),
        buttons: [
          ...document.querySelectorAll(
            ".player-surface-head button,.player-track-actions button,.transport button",
          ),
        ].map((b) => ({
          width: b.getBoundingClientRect().width,
          height: b.getBoundingClientRect().height,
        })),
        overflow: document.documentElement.scrollWidth - innerWidth,
      };
    });
    expect(metrics.art).toBeGreaterThanOrEqual(96);
    expect(metrics.art).toBeLessThanOrEqual(512);
    expect(Math.abs(metrics.art - metrics.artHeight)).toBeLessThanOrEqual(1);
    expect(metrics.title).toBeGreaterThanOrEqual(20);
    expect(metrics.artist).toBeGreaterThanOrEqual(14);
    expect(metrics.overflow).toBeLessThanOrEqual(1);
    for (const button of metrics.buttons) {
      expect(button.width).toBeGreaterThanOrEqual(44);
      expect(button.height).toBeGreaterThanOrEqual(44);
    }
    const viz = await visualizer.evaluate(() => ({
      title: parseFloat(
        getComputedStyle(document.querySelector(".visualizer-footer h2")!)
          .fontSize,
      ),
      artist: parseFloat(
        getComputedStyle(document.querySelector(".visualizer-footer p")!)
          .fontSize,
      ),
      overflow: document.documentElement.scrollWidth - innerWidth,
      pixels:
        document.querySelector("canvas")!.width *
        document.querySelector("canvas")!.height,
    }));
    expect(viz.title).toBeGreaterThanOrEqual(20);
    expect(viz.artist).toBeGreaterThanOrEqual(14);
    expect(viz.overflow).toBeLessThanOrEqual(1);
    expect(viz.pixels).toBeLessThanOrEqual(2000000);
    samples.push({ ...metrics, vizTitle: viz.title });
  }
  expect(samples[2].art).toBeGreaterThan(samples[0].art);
  expect(samples[2].title).toBeGreaterThan(samples[0].title);
  expect(samples[2].vizTitle).toBeGreaterThan(samples[0].vizTitle);
  expect(samples[2].buttons[0].width).toBeGreaterThan(
    samples[0].buttons[0].width,
  );
  // A zoom-sized view scrolls once the readable floor is reached rather than hiding controls.
  await player.setViewportSize({ width: 240, height: 320 });
  await visualizer.setViewportSize({ width: 240, height: 320 });
  for (const p of [player, visualizer]) {
    expect(
      await p.evaluate(() => document.documentElement.scrollWidth - innerWidth),
    ).toBeLessThanOrEqual(1);
    await p
      .getByRole("button", { name: "Play", exact: true })
      .scrollIntoViewIfNeeded();
    await expect(
      p.getByRole("button", { name: "Play", exact: true }),
    ).toBeInViewport();
  }
});

test("detached Back controls dismiss views without restoring popups", async ({
  page,
  context,
}) => {
  const f = new DetachedFixture(context);
  await f.attach(page);
  await page.goto("/");
  await page.locator(".mini-track").click();
  await page.getByRole("button", { name: "Open in separate window" }).click();
  await expect.poll(() => f.windows[0]?.phase).toBe("detached");
  const player = f.children.get("player")!;
  await player.getByRole("button", { name: "Queue", exact: true }).click();
  await player.keyboard.press("Escape");
  await expect(
    player.getByRole("dialog", { name: "Now playing" }),
  ).toBeVisible();
  await player.getByRole("button", { name: "Player options" }).click();
  await player.keyboard.press("Escape");
  await expect(
    player.getByRole("dialog", { name: "Now playing" }),
  ).toBeVisible();
  await player.getByRole("button", { name: "Close", exact: true }).click();
  await expect.poll(() => f.windows.length).toBe(0);
  await expect(page.getByRole("dialog", { name: "Now playing" })).toHaveCount(
    0,
  );

  await page.locator(".mini-track").click();
  await page.getByRole("button", { name: "Player options" }).click();
  await page.getByRole("menuitem", { name: "Visualizer", exact: true }).click();
  await expect
    .poll(() => f.windows.find((e) => e.view === "visualizer")?.phase)
    .toBe("detached");
  const visualizer = f.children.get("visualizer")!;
  await visualizer.getByRole("button", { name: "Back", exact: true }).click();
  await expect.poll(() => f.windows.length).toBe(0);
  await expect(page.getByRole("dialog", { name: "Visualizer" })).toHaveCount(0);
  await expect(page.getByRole("dialog", { name: "Now playing" })).toBeVisible();
});

test("Equalizer opens independently, shares edits, and closes or returns", async ({
  page,
  context,
}) => {
  const f = new DetachedFixture(context);
  f.player.trackId = null as unknown as string;
  f.player.queue = [];
  await f.attach(page);
  await page.goto("/");
  await page.getByRole("button", { name: "Library actions" }).click();
  await page.getByRole("menuitem", { name: "Equalizer", exact: true }).click();
  await expect
    .poll(() => f.windows.find((e) => e.view === "equalizer")?.phase)
    .toBe("detached");
  const equalizer = f.children.get("equalizer")!;
  await expect(
    equalizer.getByRole("heading", { name: "Equalizer", exact: true }),
  ).toBeVisible();
  await equalizer.getByRole("button", { name: "Rock", exact: true }).click();
  await expect.poll(() => f.sound.config.presetId).toBe("rock");
  await page.getByRole("button", { name: "Library actions" }).click();
  await page.getByRole("menuitem", { name: "Equalizer", exact: true }).click();
  expect(f.windows.filter((e) => e.view === "equalizer")).toHaveLength(1);
  await equalizer.getByRole("button", { name: "Back", exact: true }).click();
  await expect.poll(() => f.windows.length).toBe(0);
  await expect(page.getByRole("dialog", { name: "Equalizer" })).toHaveCount(0);
  await page.getByRole("button", { name: "Library actions" }).click();
  await page.getByRole("menuitem", { name: "Equalizer", exact: true }).click();
  await expect.poll(() => f.windows[0]?.phase).toBe("detached");
  const reopened = f.children.get("equalizer")!;
  await expect(
    reopened.getByRole("button", { name: "Rock", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await reopened.getByRole("button", { name: "Return to main window" }).click();
  await expect(
    page.getByRole("dialog", { name: "Equalizer", exact: true }),
  ).toBeVisible();
});

test("Equalizer from detached player flushes edits before closing", async ({
  page,
  context,
}) => {
  const f = new DetachedFixture(context);
  f.soundWriteDelay = 350;
  await f.attach(page);
  await page.goto("/");
  await page.locator(".mini-track").click();
  await page.getByRole("button", { name: "Open in separate window" }).click();
  await expect
    .poll(() => f.windows.find((e) => e.view === "player")?.phase)
    .toBe("detached");
  const player = f.children.get("player")!;
  await player.getByRole("button", { name: "Player options" }).click();
  await player
    .getByRole("menuitem", { name: "Equalizer", exact: true })
    .click();
  await expect
    .poll(() => f.windows.find((e) => e.view === "equalizer")?.phase)
    .toBe("detached");
  const equalizer = f.children.get("equalizer")!;
  await expect(
    equalizer.getByRole("button", { name: "Jazz", exact: true }),
  ).toBeVisible();
  await equalizer.getByRole("button", { name: "Jazz", exact: true }).click();
  await equalizer.getByRole("button", { name: "Back", exact: true }).click();
  await expect
    .poll(() => f.windows.some((e) => e.view === "equalizer"))
    .toBe(false);
  expect(f.sound.config.presetId).toBe("jazz");
  await expect(
    player.getByRole("dialog", { name: "Now playing", exact: true }),
  ).toBeVisible();
});
