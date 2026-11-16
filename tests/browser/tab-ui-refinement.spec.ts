import { test, expect, type Page } from "@playwright/test";
import { seedInlineCatalog } from "./inlineSearchFixture";
import { openSettings } from "./navigationHelpers";

async function samples(page: Page) {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "Explore with sample audio" }).click();
  await expect(page.locator("#library-content .track-row")).toHaveCount(8);
  await page.evaluate(() => document.fonts.ready);
}

test("selected phone tabs align left without changing label geometry", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await samples(page);
  const strip = page.locator(".section-tabs");
  await strip.evaluate((el) => {
    el.scrollLeft = 25;
  });
  const geometry = () =>
    strip.locator("button").evaluateAll((els) =>
      els.map((el) => ({
        left: (el as HTMLElement).offsetLeft,
        width: (el as HTMLElement).offsetWidth,
      })),
    );
  const before = await geometry();
  await page.getByRole("tab", { name: "Artists", exact: true }).click();
  await expect(
    page.getByRole("tab", { name: "Artists", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  expect(await geometry()).toEqual(before);
  expect(
    Math.abs(
      (await page.locator("#tab-artists").boundingBox())!.x -
        (await strip.boundingBox())!.x,
    ),
  ).toBeLessThanOrEqual(1);
  // Moving the strip itself must not choose a different collection.
  await strip.evaluate((el) => {
    el.scrollLeft = el.scrollWidth;
  });
  await expect(page.getByRole("tab", { selected: true })).toHaveText("Artists");
  await page.getByRole("tab", { name: "Your Recap", exact: true }).click();
  const selected = await page
      .getByRole("tab", { selected: true })
      .boundingBox(),
    bounds = (await strip.boundingBox())!;
  expect(selected!.x).toBeGreaterThanOrEqual(bounds.x - 1);
  expect(selected!.x + selected!.width).toBeLessThanOrEqual(
    bounds.x + bounds.width + 1,
  );
  await page.setViewportSize({ width: 320, height: 844 });
  // Native scroll offsets round to pixels; allow a subpixel edge difference.
  await expect
    .poll(async () => {
      const selected = (await page
        .getByRole("tab", { selected: true })
        .boundingBox())!;
      const viewport = (await strip.boundingBox())!;
      return Math.max(
        viewport.x - selected.x,
        selected.x + selected.width - viewport.x - viewport.width,
      );
    })
    .toBeLessThanOrEqual(1);
});

test("keyboard tab focus never changes the Library's vertical scroll", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await seedInlineCatalog(page);
  await page.evaluate(() =>
    (
      document.querySelector<HTMLElement>(
        '.library-pane[data-active="true"]',
      ) ?? window
    ).scrollTo({ top: 260, behavior: "instant" }),
  );
  const before = await page.evaluate(
    () =>
      document.querySelector<HTMLElement>('.library-pane[data-active="true"]')
        ?.scrollTop ?? window.scrollY,
  );
  expect(before).toBeGreaterThan(200);
  await page
    .getByRole("tab", { name: "Songs", exact: true })
    .evaluate((el) => (el as HTMLElement).focus({ preventScroll: true }));
  await page.keyboard.press("ArrowRight");
  await expect(
    page.getByRole("tab", { name: "Albums", exact: true }),
  ).toBeFocused();
  expect(
    await page.evaluate(
      () =>
        document.querySelector<HTMLElement>('.library-pane[data-active="true"]')
          ?.scrollTop ?? window.scrollY,
    ),
  ).toBeCloseTo(before, 0);
  await page.keyboard.press("End");
  await expect(
    page.getByRole("tab", { name: "Your Recap", exact: true }),
  ).toBeInViewport();
  expect(
    await page.evaluate(
      () =>
        document.querySelector<HTMLElement>('.library-pane[data-active="true"]')
          ?.scrollTop ?? window.scrollY,
    ),
  ).toBeCloseTo(before, 0);
  await expect(page.getByRole("tab", { selected: true })).toHaveText("Songs");
});

test("Spanish dark tabs retain their geometry at 320px with doubled text", async ({
  page,
}) => {
  await samples(page);
  const settings = await openSettings(page);
  await settings.getByRole("button", { name: "Español", exact: true }).click();
  await settings.getByRole("button", { name: "Oscuro", exact: true }).click();
  await page.keyboard.press("Escape");
  await page.setViewportSize({ width: 320, height: 640 });
  const strip = page.locator(".section-tabs");
  await strip.locator("button").evaluateAll((els) =>
    els.forEach((el) => {
      (el as HTMLElement).style.fontSize =
        `${parseFloat(getComputedStyle(el).fontSize) * 2}px`;
    }),
  );
  const geometry = () =>
    strip.locator("button").evaluateAll((els) =>
      els.map((el) => ({
        left: (el as HTMLElement).offsetLeft,
        width: (el as HTMLElement).offsetWidth,
      })),
    );
  const before = await geometry();
  await page.getByRole("tab", { name: "Álbumes", exact: true }).click();
  await expect(
    page.getByRole("tab", { name: "Álbumes", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  expect(await geometry()).toEqual(before);
  await expect
    .poll(async () => {
      const selected = (await page
          .getByRole("tab", { selected: true })
          .boundingBox())!,
        indicator = (await page.locator(".section-indicator").boundingBox())!;
      return Math.max(
        Math.abs(selected.x - indicator.x),
        Math.abs(selected.width - indicator.width),
      );
    })
    .toBeLessThanOrEqual(1);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - innerWidth,
    ),
  ).toBeLessThanOrEqual(1);
});

test("phone Songs keep title and artist while redundant collection metadata stays hidden", async ({
  page,
}) => {
  await samples(page);
  const row = page.locator("#library-content .track-row").first();
  await expect(row.locator(".track-copy strong")).toBeVisible();
  await expect(row.locator(".track-artist")).toBeVisible();
  await expect(row.locator(".track-duration-inline")).toBeHidden();
  await expect(row.locator(".album-label")).toBeHidden();
  await expect(
    row.getByRole("button", { name: "Favorite", exact: true }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "Albums", exact: true }).click();
  await page.locator("#library-content .album-card").first().click();
  await expect(
    page.locator("#library-content .track-row .track-duration-inline").first(),
  ).toBeHidden();
  await page.getByRole("button", { name: "Library", exact: true }).click();
  await page.getByRole("tab", { name: "Songs", exact: true }).click();
  await page.setViewportSize({ width: 1280, height: 800 });
  await expect(row.locator(".album-label")).toBeVisible();
  await expect(row.locator(":scope > .track-duration")).toBeHidden();
});

test("phone Artists are full-width rows while Albums and desktop Artists retain cards", async ({
  page,
}) => {
  await samples(page);
  await page.getByRole("tab", { name: "Artists", exact: true }).click();
  const cards = page.locator("#library-content .album-card");
  await expect(cards.nth(1)).toBeVisible();
  const first = (await cards.nth(0).boundingBox())!,
    second = (await cards.nth(1).boundingBox())!;
  expect(second.y).toBeGreaterThanOrEqual(first.y + first.height - 1);
  expect(first.width).toBeGreaterThan(340);
  const image = (await cards.first().locator(".cover").boundingBox())!;
  expect(image.width).toBe(44);
  expect(image.height).toBe(44);
  await cards.first().click();
  await expect(page.locator("#library-content .collection-hero h1")).toBeVisible();
  await page.getByRole("button", { name: "Library", exact: true }).click();
  await page.getByRole("tab", { name: "Albums", exact: true }).click();
  const a = (await cards.nth(0).boundingBox())!,
    b = (await cards.nth(1).boundingBox())!;
  expect(Math.abs(a.y - b.y)).toBeLessThan(1);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.getByRole("tab", { name: "Artists", exact: true }).click();
  expect(
    Math.abs(
      (await cards.nth(0).boundingBox())!.y -
        (await cards.nth(1).boundingBox())!.y,
    ),
  ).toBeLessThan(1);
});

test("Android player opens without a fade or mini-player progress sliver", async ({
  page,
}) => {
  await samples(page);
  await page.evaluate(() => {
    document.documentElement.dataset.platform = "android";
  });
  await page.locator("#library-content .track-hit").first().click();
  await page
    .locator(".mobile-mini-play")
    .getByRole("button", { name: "Pause", exact: true })
    .click();
  await expect(page.locator(".mini-progress")).toHaveCount(0);
  await page.locator(".mini-track").click();
  const player = page.getByRole("dialog", { name: "Now playing", exact: true });
  await expect(player).toBeVisible();
  await expect(player).toHaveCSS("animation-name", "none");
  await expect(player.locator(".player-cover")).toBeVisible();
  await expect(player.locator(".progress input")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(player).toHaveCount(0);
  await expect(page.locator(".cover-flight")).toHaveCount(0);
});

test("phone carousel anchors every activated tab left and content follows horizontal dragging", async ({
  page,
}) => {
  await samples(page);
  const strip = page.locator(".section-tabs");
  for (const id of ["albums", "artists", "playlists", "year", "songs"]) {
    await page.locator(`#tab-${id}`).click();
    await expect
      .poll(async () => {
        const selected = (await page.locator(`#tab-${id}`).boundingBox())!;
        return Math.abs(selected.x - (await strip.boundingBox())!.x);
      })
      .toBeLessThanOrEqual(1);
    await expect(page.locator("#library-content")).toHaveCSS(
      "transform",
      "none",
    );
    expect(
      await page
        .locator("#library-content")
        .evaluate((node) => node.getAnimations().length),
    ).toBe(0);
  }
  const content = page.locator(".library-pager-track");
  await page.locator(".library-page").dispatchEvent("pointerdown", {
    pointerType: "touch",
    pointerId: 42,
    isPrimary: true,
    clientX: 300,
    clientY: 350,
  });
  await page.locator(".library-page").dispatchEvent("pointermove", {
    pointerType: "touch",
    pointerId: 42,
    isPrimary: true,
    clientX: 80,
    clientY: 350,
  });
  const dx = await content.evaluate(
    (el) => new DOMMatrixReadOnly(getComputedStyle(el).transform).m41,
  );
  expect(dx).toBeLessThan(-20);
  expect(dx).toBeCloseTo(-220, 0);
  await page.locator(".library-page").dispatchEvent("pointerup", {
    pointerType: "touch",
    pointerId: 42,
    isPrimary: true,
    clientX: 80,
    clientY: 350,
  });
  await expect(page.locator("#tab-albums")).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect
    .poll(async () =>
      Math.abs(
        (await page.locator("#tab-albums").boundingBox())!.x -
          (await strip.boundingBox())!.x,
      ),
    )
    .toBeLessThanOrEqual(1);
});

test("phone tab entry is brief, directional and opaque; replacement cancels it and Reduce Motion skips it", async ({
  page,
}) => {
  await samples(page);
  const inspect = (id: string) =>
    page.evaluate(async (id) => {
      const captured: { frames: Keyframe[]; duration: CSSNumberish }[] = [];
      const original = Element.prototype.animate;
      Element.prototype.animate = function (...args) {
        const animation = original.apply(this, args);
        if (this.matches(".library-pager-track"))
          captured.push({ frames: (animation.effect as KeyframeEffect).getKeyframes(), duration: animation.effect!.getTiming().duration });
        return animation;
      };
      (document.querySelector(`#tab-${id}`) as HTMLButtonElement).click();
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => resolve()),
      );
      Element.prototype.animate = original;
      return captured;
    }, id);
  const forward = await inspect("albums");
  expect(forward).toHaveLength(1);
  expect(forward[0].duration).toBe(180);
  const width = await page.locator(".library-pager-track").evaluate(el => el.clientWidth);
  expect(forward[0].frames[0].transform).toBe(`translateX(${width}px)`);
  expect(forward[0].frames.every((f) => !("opacity" in f))).toBe(true);
  const back = await inspect("songs");
  expect(back).toHaveLength(1);
  expect(back[0].frames[0].transform).toBe(`translateX(${-width}px)`);
  await page
    .locator(".library-pager-track")
    .evaluate((el) =>
      Promise.all(el.getAnimations().map((a) => a.finished.catch(() => {}))),
    );
  await expect(page.locator(".library-pager-track")).toHaveCSS("transform", "none");
  await page.emulateMedia({ reducedMotion: "reduce" });
  expect(await inspect("albums")).toHaveLength(0);
});
