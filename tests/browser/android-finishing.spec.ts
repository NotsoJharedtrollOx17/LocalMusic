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
  const frames = await page.locator(".mini-track").evaluate(async (el) => {
    const captured: Keyframe[] = [];
    Object.assign(window, { playerTransitionFrames: captured });
    const animate = HTMLElement.prototype.animate;
    HTMLElement.prototype.animate = function (...args) {
      if (this.matches(".player-surface") && Array.isArray(args[0]))
        captured.push(...(args[0] as Keyframe[]));
      return animate.apply(this, args);
    };
    (el as HTMLElement).focus();
    (el as HTMLElement).click();
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => resolve()),
    );
    return captured;
  });
  const player = page.locator(".player-surface");
  expect(frames[0].transform).toMatch(/^translateY\([1-9]/);
  expect(frames.every((f) => !("clipPath" in f))).toBe(true);
  expect(frames.every((f) => !("opacity" in f))).toBe(true);
  await player.evaluate((el) =>
    Promise.all(el.getAnimations().map((a) => a.finished.catch(() => {}))),
  );
  const exit = await player
    .getByRole("button", { name: "Close", exact: true })
    .evaluate((el) => {
      const frames = (
        window as unknown as { playerTransitionFrames: Keyframe[] }
      ).playerTransitionFrames;
      frames.length = 0;
      (el as HTMLElement).click();
      return frames;
    });
  expect(exit.at(-1)!.transform).toMatch(/^translateY\([1-9]/);
  expect(exit.every((f) => !("clipPath" in f))).toBe(true);
  await expect(player).toHaveCount(0);
  await expect(page.locator(".mini-track")).toBeFocused();
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
