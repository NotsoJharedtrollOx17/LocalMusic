import { test, expect } from "@playwright/test";
test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });
async function setup(page: import("@playwright/test").Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Explore with sample audio" }).click();
  await expect(page.locator(".track-row")).toHaveCount(8);
  await page.evaluate(
    () => (document.documentElement.dataset.platform = "android"),
  );
}
test("song Play requests one system touch feedback; a cancelled hold does not", async ({
  page,
}) => {
  await setup(page);
  await page.evaluate(() => {
    (window as any).__touchCalls = [];
    (window as any).__TAURI_INTERNALS__ = {
      invoke: async (command: string) => {
        (window as any).__touchCalls.push(command);
        return {};
      },
    };
  });
  const hit = page.locator(".track-hit").first();
  await hit.click();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as any).__touchCalls.filter(
            (x: string) => x === "touch_feedback",
          ).length,
      ),
    )
    .toBe(1);
  await hit.dispatchEvent("pointerdown", {
    pointerType: "touch",
    pointerId: 5,
    isPrimary: true,
    clientX: 100,
    clientY: 300,
  });
  await hit.dispatchEvent("pointercancel", {
    pointerType: "touch",
    pointerId: 5,
    isPrimary: true,
  });
  expect(
    await page.evaluate(
      () =>
        (window as any).__touchCalls.filter(
          (x: string) => x === "touch_feedback",
        ).length,
    ),
  ).toBe(1);
});
test("Android player grows from the mini rectangle and closes by shrinking back", async ({
  page,
}) => {
  await setup(page);
  await page.locator(".track-hit").first().click();
  const frames = await page.locator(".mini-track").evaluate(async (el) => {
    (el as HTMLElement).focus();
    (el as HTMLElement).click();
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => resolve()),
    );
    return document
      .querySelector(".player-surface")!
      .getAnimations()
      .flatMap((a) => (a.effect as KeyframeEffect).getKeyframes());
  });
  const player = page.locator(".player-surface");
  expect(frames[0].transform).toContain("scale(");
  expect(frames[0].transform).toContain("translate(");
  expect(frames.every((f) => !("opacity" in f))).toBe(true);
  await player.evaluate((el) =>
    Promise.all(el.getAnimations().map((a) => a.finished.catch(() => {}))),
  );
  await player
    .getByRole("button", { name: "Close", exact: true })
    .evaluate((el) => (el as HTMLElement).click());
  const exit = await player.evaluate((el) =>
    el
      .getAnimations()
      .flatMap((a) => (a.effect as KeyframeEffect).getKeyframes()),
  );
  expect(exit.at(-1)!.transform).toContain("scale(");
  expect(exit.at(-1)!.transform).not.toContain("100%");
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
  await expect(page.locator(".track-row")).toHaveCount(1);
  await expect(page.locator(".track-row")).toContainText("A quieter orbit");
});
