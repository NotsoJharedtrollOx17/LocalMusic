import { test, expect } from "@playwright/test";
import { DetachedFixture } from "./detached-window-fixture";

test("large detached Queue targets remain separate as controls grow", async ({
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
  await child.getByRole("button", { name: "Queue", exact: true }).click();
  for (const size of [
    { width: 1200, height: 1000 },
    { width: 960, height: 800 },
    { width: 720, height: 600 },
    { width: 360, height: 480 },
  ]) {
    await child.setViewportSize(size);
    const boxes = await child
      .locator(".queue-content .row-actions button")
      .evaluateAll((els) =>
        els.map((el) => {
          const r = el.getBoundingClientRect();
          return { x: r.x, right: r.right, width: r.width, y: r.y };
        }),
      );
    expect(boxes).toHaveLength(3);
    for (let i = 0; i < boxes.length; i++) {
      expect(boxes[i].width).toBeGreaterThanOrEqual(44);
      if (i)
        expect(boxes[i].x).toBeGreaterThanOrEqual(boxes[i - 1].right - 0.1);
    }
    expect(
      await child
        .locator(".queue-content")
        .evaluate((el) => el.scrollWidth - el.clientWidth),
    ).toBeLessThanOrEqual(1);
  }
});

test("detached EQ uses its available height and retains scrolling in short windows", async ({
  page,
  context,
}) => {
  const f = new DetachedFixture(context);
  await f.attach(page);
  await page.goto("/");
  await page
    .getByRole("button", { name: "Library actions", exact: true })
    .click();
  await page.getByRole("menuitem", { name: "Equalizer", exact: true }).click();
  await expect.poll(() => f.children.has("equalizer")).toBe(true);
  const child = f.children.get("equalizer")!;
  await child.setViewportSize({ width: 1000, height: 800 });
  const body = (await child.locator(".detached-equalizer-body").boundingBox())!;
  const controls = (await child.locator(".sound-controls").boundingBox())!;
  expect(
    Math.abs(body.y + body.height / 2 - controls.y - controls.height / 2),
  ).toBeLessThan(3);
  await child.setViewportSize({ width: 800, height: 360 });
  await child
    .locator('.equalizer-band input[type="range"]')
    .last()
    .scrollIntoViewIfNeeded();
  await expect(
    child.locator('.equalizer-band input[type="range"]').last(),
  ).toBeInViewport();
  await expect(
    child.getByRole("button", { name: "Back", exact: true }),
  ).toBeInViewport();
});

test("cached desktop tab switches keep confirmed content opaque and immediately interactive", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Explore with sample audio", exact: true })
    .click();
  await expect(page.locator(".track-row")).toHaveCount(8);
  await page.evaluate(() => {
    const animate = Element.prototype.animate;
    Object.assign(window, { desktopFades: [] as number[] });
    Element.prototype.animate = function (...args) {
      const a = animate.apply(this, args);
      if (this.id === "library-content")
        (window as unknown as { desktopFades: number[] }).desktopFades.push(
          ...(a.effect as KeyframeEffect)
            .getKeyframes()
            .map((f) => Number(f.opacity ?? 1)),
        );
      return a;
    };
  });
  for (const tab of [
    "albums",
    "artists",
    "playlists",
    "songs",
    "albums",
    "artists",
  ]) {
    await page.locator("#tab-" + tab).click();
    await expect(page.locator("#tab-" + tab)).toHaveAttribute(
      "aria-selected",
      "true",
    );
  }
  expect(
    await page.evaluate(() =>
      (window as unknown as { desktopFades: number[] }).desktopFades.every(
        (value) => value === 1,
      ),
    ),
  ).toBe(true);
  await page.locator(".catalog-artists .album-card").first().click();
  await expect(page.locator(".collection-hero")).toBeVisible();
});
