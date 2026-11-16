import { expect, type Locator, type Page } from "@playwright/test";

/** Inspect settled presentation, without disabling the motion under test. */
export async function settleUI(page: Page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    for (let pass = 0; pass < 3; pass++) {
      await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
      await Promise.all(document.getAnimations().filter((a) => a.playState === "running" && a.effect?.getComputedTiming().iterations !== Infinity).map((a) => a.finished.catch(() => {})));
    }
  });
}

export async function stableBounds(control: Locator) {
  let previous: Awaited<ReturnType<Locator["boundingBox"]>> = null, stable = 0;
  await expect.poll(async () => {
    const next = await control.boundingBox();
    stable = next && previous && (["x", "y", "width", "height"] as const).every((k) => Math.abs(next[k] - previous![k]) < 0.25) ? stable + 1 : 0;
    previous = next;
    return stable;
  }).toBeGreaterThanOrEqual(2);
}
