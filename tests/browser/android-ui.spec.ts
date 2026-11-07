import { test, expect, type Page, type Locator } from "@playwright/test";
import { openSettings, openEqualizer } from "./navigationHelpers";

async function samples(page: Page) {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Explore with sample audio", exact: true })
    .click();
  await expect(page.locator(".track-row")).toHaveCount(8);
}
async function full(page: Page, dialog: Locator) {
  await expect(dialog).toBeVisible();
  const box = await dialog.boundingBox();
  const viewport = await page.evaluate(() => ({
    width: visualViewport!.width,
    height: visualViewport!.height,
    top: visualViewport!.offsetTop,
    left: visualViewport!.offsetLeft,
  }));
  expect(Math.abs(box!.x - viewport.left)).toBeLessThanOrEqual(1);
  expect(Math.abs(box!.y - viewport.top)).toBeLessThanOrEqual(1);
  expect(Math.abs(box!.width - viewport.width)).toBeLessThanOrEqual(1);
  expect(Math.abs(box!.height - viewport.height)).toBeLessThanOrEqual(1);
  await expect(
    dialog.getByRole("button", { name: "Close", exact: true }),
  ).toBeInViewport();
}

for (const size of [
  { width: 411, height: 868 },
  { width: 868, height: 411 },
])
  test(`phone task dialogs fill the visible viewport at ${size.width}px`, async ({
    page,
  }) => {
    await page.setViewportSize(size);
    await samples(page);
    // Exercise the real Android CSS policy independently of browser/native adapters.
    await page.evaluate(
      () => (document.documentElement.dataset.platform = "android"),
    );
    const settings = await openSettings(page);
    await full(page, settings);
    await settings
      .getByRole("button", { name: "Organize library", exact: true })
      .click();
    const org = page.getByRole("dialog", {
      name: "Organize library",
      exact: true,
    });
    await full(page, org);
    await page.keyboard.press("Escape");
    await expect(settings).toBeVisible();
    await page.keyboard.press("Escape");
    const eq = await openEqualizer(page);
    await full(page, eq);
    await expect(eq.getByRole("slider")).toHaveCount(9);
    await page.keyboard.press("Escape");
    await page.getByRole("tab", { name: "Playlists", exact: true }).click();
    await page
      .getByRole("button", { name: "New playlist", exact: true })
      .click();
    await full(
      page,
      page.getByRole("dialog", { name: "New playlist", exact: true }),
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth - innerWidth,
      ),
    ).toBeLessThanOrEqual(1);
  });

test("task dialogs follow visible viewport resize and keep compact renaming centered", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await samples(page);
  await page.evaluate(() => {
    const viewport = Object.assign(new EventTarget(), {
      width: innerWidth,
      height: innerHeight,
      offsetLeft: 0,
      offsetTop: 0,
    });
    Object.defineProperty(window, "visualViewport", {
      configurable: true,
      value: viewport,
    });
  });
  await page.getByRole("tab", { name: "Playlists", exact: true }).click();
  await page.getByRole("button", { name: "New playlist", exact: true }).click();
  const dialog = page.getByRole("dialog", {
    name: "New playlist",
    exact: true,
  });
  await dialog
    .getByLabel("Playlist name", { exact: true })
    .fill("Keyboard mix");
  await dialog.getByRole("checkbox").first().check();
  await page.evaluate(() => {
    Object.assign(visualViewport!, { height: 400, offsetTop: 12 });
    visualViewport!.dispatchEvent(new Event("resize"));
  });
  await full(page, dialog);
  await expect(dialog.locator(".modal-body")).toHaveCSS("overflow-y", "auto");
  await dialog.locator(".modal-body").evaluate((node) => {
    node.scrollTop = node.scrollHeight;
  });
  await expect(
    dialog.getByRole("button", { name: "Save", exact: true }),
  ).toBeInViewport();
  await dialog.getByRole("button", { name: "Save", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await page
    .getByRole("button", {
      name: "Playlist options: Keyboard mix",
      exact: true,
    })
    .click();
  await page
    .getByRole("menuitem", { name: "Rename playlist", exact: true })
    .click();
  const rename = page.getByRole("dialog", {
    name: "Rename playlist",
    exact: true,
  });
  await expect(rename).toBeVisible();
  await expect
    .poll(async () => {
      const rect = await rename.boundingBox();
      return Math.abs(rect!.y + rect!.height / 2 - (12 + 200));
    })
    .toBeLessThanOrEqual(1);
  const b = await rename.boundingBox();
  expect(Math.abs(b!.y + b!.height / 2 - (12 + 200))).toBeLessThanOrEqual(1);
  expect(b!.height).toBeLessThan(400);
  await expect(
    rename.getByRole("button", { name: "Save", exact: true }),
  ).toBeInViewport();
});

test("horizontal intent changes one tab without moving the Library or activating short drags", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await samples(page);
  const panel = page.locator(".library-page"),
    row = page.locator(".track-hit").first();
  const pointer = (x: number, y: number, id = 1) => ({
    pointerType: "touch",
    pointerId: id,
    clientX: x,
    clientY: y,
    isPrimary: id === 1,
  });
  await row.dispatchEvent("pointerdown", pointer(300, 350));
  await row.dispatchEvent("pointermove", pointer(265, 350));
  await expect(panel).toHaveCSS("transform", "none");
  await row.dispatchEvent("pointerup", pointer(265, 350));
  await row.dispatchEvent("click", { detail: 1 });
  await expect(page.locator(".mini-player")).toHaveCount(0);
  await expect(
    page.getByRole("tab", { name: "Songs", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await panel.dispatchEvent("pointerdown", pointer(310, 350));
  await panel.dispatchEvent("pointermove", pointer(80, 350));
  await expect(panel).toHaveCSS("transform", "none");
  await panel.dispatchEvent("pointerup", pointer(80, 350));
  await expect(
    page.getByRole("tab", { name: "Albums", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  expect(
    await panel.locator("#library-content").evaluate((node) =>
      node
        .getAnimations()
        .flatMap((a) => (a.effect as KeyframeEffect).getKeyframes())
        .some((f) => "transform" in f),
    ),
  ).toBe(false);
  // A vertical scroll, canceled gesture or second finger must not navigate.
  await panel.dispatchEvent("pointerdown", pointer(300, 350));
  await panel.dispatchEvent("pointermove", pointer(280, 480));
  await panel.dispatchEvent("pointerup", pointer(80, 480));
  await panel.dispatchEvent("pointerdown", pointer(300, 350));
  await panel.dispatchEvent("pointermove", pointer(80, 350));
  await panel.dispatchEvent("pointercancel", pointer(80, 350));
  await panel.dispatchEvent("pointerup", pointer(80, 350));
  await panel.dispatchEvent("pointerdown", pointer(300, 350));
  await panel.dispatchEvent("pointerdown", pointer(280, 350, 2));
  await panel.dispatchEvent("pointermove", pointer(80, 350));
  await panel.dispatchEvent("pointerup", pointer(80, 350));
  await expect(
    page.getByRole("tab", { name: "Albums", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await expect(panel).toHaveCSS("transform", "none");
});

test("Android landscape player fills the window with reachable transport beside artwork", async ({
  page,
}) => {
  await page.setViewportSize({ width: 868, height: 411 });
  await samples(page);
  await page.evaluate(
    () => (document.documentElement.dataset.platform = "android"),
  );
  await page.locator(".track-hit").first().click();
  await page.locator(".mini-track").click();
  const player = page.getByRole("dialog", { name: "Now playing", exact: true });
  await full(page, player);
  const body = await player.locator(".player-surface-body").boundingBox(),
    footer = await player.locator(".player-surface-footer").boundingBox();
  expect(footer!.x).toBeGreaterThanOrEqual(body!.x + body!.width - 1);
  await expect(player.locator(".transport .play-circle")).toBeInViewport();
  await player.getByRole("button", { name: "Queue", exact: true }).click();
  await full(page, page.getByRole("dialog", { name: "Queue", exact: true }));
});
