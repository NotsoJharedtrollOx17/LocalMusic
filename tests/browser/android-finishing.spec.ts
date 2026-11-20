import { test, expect } from "@playwright/test";
test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });
async function setup(page: import("@playwright/test").Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Explore with sample audio" }).click();
  await expect(page.locator("#library-content .track-row")).toHaveCount(8);
  await page.evaluate(
    () => (document.documentElement.dataset.platform = "android"),
  );
}
test("Android song feedback appears after a tap confirms activation", async ({
  page,
}) => {
  await setup(page);
  const hit = page.locator("#library-content .track-hit").first();
  const active = await hit.evaluate((el) => {
    // Keep a short tap in one browser task: runner/compile load must not
    // accidentally turn a press-feedback check into a 480 ms selection hold.
    el.dispatchEvent(
      new PointerEvent("pointerdown", {
        bubbles: true,
        pointerType: "touch",
        pointerId: 5,
        isPrimary: true,
        clientX: 100,
        clientY: 300,
      }),
    );
    const duringPress = el.getAttribute("data-pressed");
    el.dispatchEvent(
      new PointerEvent("pointerup", {
        bubbles: true,
        pointerType: "touch",
        pointerId: 5,
        isPrimary: true,
        clientX: 100,
        clientY: 300,
      }),
    );
    el.dispatchEvent(
      new PointerEvent("lostpointercapture", {
        bubbles: true,
        pointerType: "touch",
        pointerId: 5,
        isPrimary: true,
      }),
    );
    const afterRelease = el.getAttribute("data-pressed");
    (el as HTMLElement).click();
    return {
      duringPress,
      afterRelease,
      afterActivation: el.getAttribute("data-pressed"),
    };
  });
  expect(active).toEqual({
    duringPress: null,
    afterRelease: "true",
    afterActivation: "true",
  });
  await expect(page.locator(".mini-player")).toBeVisible();
  await expect(hit).not.toHaveAttribute("data-pressed", "true");
});

test("Your Recap stays left anchored and scroll intent never paints a song press", async ({
  page,
}) => {
  await setup(page);
  const tab = page.locator("#tab-year");
  const strip = page.locator(".section-tabs");
  await tab.click();
  await expect.poll(async () => Math.abs((await tab.boundingBox())!.x -
    (await strip.boundingBox())!.x)).toBeLessThanOrEqual(1);
  await page.locator("#tab-songs").click();
  const hit = page.locator("#library-content .track-hit").first();
  const state = await hit.evaluate((el) => {
    const dispatch = (type: string, y: number) => el.dispatchEvent(
      new PointerEvent(type, {
        bubbles: true, pointerType: "touch", isPrimary: true,
        pointerId: 17, clientX: 80, clientY: y,
      }),
    );
    dispatch("pointerdown", 300);
    const down = el.hasAttribute("data-pressed");
    dispatch("pointermove", 304);
    const drift = el.hasAttribute("data-pressed");
    dispatch("pointermove", 320);
    dispatch("pointerup", 320);
    el.dispatchEvent(new MouseEvent("click", { bubbles: true, detail: 1 }));
    return { down, drift, released: el.hasAttribute("data-pressed") };
  });
  expect(state).toEqual({ down: false, drift: false, released: false });
  await expect(page.locator(".mini-player")).toHaveCount(0);
});

test("Android player grows from the mini rectangle and closes by shrinking back", async ({
  page,
}) => {
  await setup(page);
  await page.locator("#library-content .track-hit").first().click();
  const mini = page.locator(".mini-track");
  const first = await mini.evaluate(async (el) => {
    (el as HTMLElement).focus();
    (el as HTMLElement).click();
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    const panel = document.querySelector<HTMLElement>(".android-player-backdrop")!;
    const bounds = panel.getBoundingClientRect();
    return { height: bounds.height, top: bounds.top, viewport: innerHeight,
      opacity: getComputedStyle(panel).opacity, clip: getComputedStyle(panel).clipPath };
  });
  expect(first.height).toBeLessThan(first.viewport);
  expect(first.top).toBeGreaterThan(0);
  expect(first.opacity).toBe("1");
  expect(first.clip).toBe("none");
  const player = page.locator(".player-surface");
  await expect(player).not.toHaveAttribute("data-player-transition");
  await expect(player.locator(".android-player-backdrop")).toHaveCSS("transform", "none");
  const closing = await player.getByRole("button", { name: "Close", exact: true }).evaluate(async (button) => {
    const panel = document.querySelector<HTMLElement>(".android-player-backdrop")!;
    const fullHeight = panel.getBoundingClientRect().height;
    (button as HTMLElement).click();
    const heights: number[] = [];
    for (let frame = 0; frame < 30 && panel.isConnected; frame++) {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      if (panel.isConnected) heights.push(panel.getBoundingClientRect().height);
    }
    return { fullHeight, heights };
  });
  expect(closing.heights.some((height) => height > first.height &&
    height < closing.fullHeight)).toBe(true);
  await expect(player).toHaveCount(0);
  await expect(page.locator(".cover-flight")).toHaveCount(0);
  await expect(mini).toBeFocused();
});

test("Android player tracks a drag and releases a canceled preview without taking focus", async ({ page }) => {
  await setup(page);
  await page.locator("#library-content .track-hit").first().click();
  const mini = page.locator(".mini-track");
  await mini.focus();
  const touch = (y: number) => ({ bubbles: true, pointerType: "touch", pointerId: 9,
    isPrimary: true, button: 0, clientX: 80, clientY: y });
  await mini.dispatchEvent("pointerdown", touch(750));
  await mini.dispatchEvent("pointermove", touch(702));
  const preview = page.locator(".player-scrim[data-player-preview]");
  await expect(preview).toHaveAttribute("inert", "");
  const sheet = preview.locator(".android-player-backdrop");
  const first = (await sheet.boundingBox())!.height;
  await mini.dispatchEvent("pointermove", touch(630));
  expect((await sheet.boundingBox())!.height).toBeGreaterThan(first);
  await mini.dispatchEvent("pointercancel", touch(630));
  await expect(preview).toHaveCount(0);
  await expect(page.locator(".cover-flight")).toHaveCount(0);
  await expect(mini).toBeFocused();
});

test("closing an observed Android keyboard collapses search while retaining its filter", async ({
  page,
}) => {
  await setup(page);
  await page
    .getByRole("button", { name: "Search your library", exact: true })
    .click();
  const input = page.getByRole("searchbox");
  await input.fill("orbit");
  const viewport = await page.evaluate(() => visualViewport!.height);
  await page.evaluate(() => {
    Object.defineProperty(visualViewport!, "height", {
      configurable: true,
      value: 400,
    });
    visualViewport!.dispatchEvent(new Event("resize"));
  });
  await expect(input).toBeVisible();
  await page.evaluate((height) => {
    Object.defineProperty(visualViewport!, "height", {
      configurable: true,
      value: height,
    });
    visualViewport!.dispatchEvent(new Event("resize"));
  }, viewport);
  await expect(input).toHaveCount(0);
  await expect(page.locator("#library-content .track-row")).toHaveCount(1);
  await expect(page.locator("#library-content .track-row")).toContainText(
    "A quieter orbit",
  );
});
