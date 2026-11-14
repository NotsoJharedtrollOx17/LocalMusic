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
test("song press highlights immediately and briefly after activation without haptics", async ({
  page,
}) => {
  await setup(page);
  const hit = page.locator(".track-hit").first();
  await hit.dispatchEvent("pointerdown", {
    pointerType: "touch",
    pointerId: 5,
    isPrimary: true,
    clientX: 100,
    clientY: 300,
  });
  await expect(hit).toHaveAttribute("data-pressed", "true");
  const active = await hit.evaluate((el) => {
    el.dispatchEvent(
      new PointerEvent("pointerup", {
        bubbles: true,
        pointerType: "touch",
        pointerId: 5,
        isPrimary: true,
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
    return { afterRelease, afterActivation: el.getAttribute("data-pressed") };
  });
  expect(active).toEqual({ afterRelease: "true", afterActivation: "true" });
  await expect(page.locator(".mini-player")).toBeVisible();
  await expect(hit).not.toHaveAttribute("data-pressed", "true");
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
  expect(frames[0].clipPath).toContain("inset(");
  expect(frames.every((f) => !("transform" in f))).toBe(true);
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
  expect(exit.at(-1)!.clipPath).toContain("inset(");
  expect(exit.every((f) => !("transform" in f))).toBe(true);
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
