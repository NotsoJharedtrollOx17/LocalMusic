import { test, expect, type Page } from "@playwright/test";
test.use({ hasTouch: true });

async function library(page: Page) {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page
    .getByRole("button", { name: "Explore with sample audio", exact: true })
    .click();
  await expect(page.locator("#library-content .track-row")).toHaveCount(8);
}

for (const interruption of [
  "blur",
  "secondary pointer",
  "replacement pointer",
  "lost capture",
  "background",
  "overlay ownership",
]) {
  test(`song hold cancels on ${interruption} without selecting or playing`, async ({
    page,
  }) => {
    await library(page);
    const hit = page.locator("#library-content .track-hit").first();
    await hit.dispatchEvent("pointerdown", {
      pointerType: "touch",
      pointerId: 4,
      isPrimary: true,
      clientX: 90,
      clientY: 300,
    });
    if (interruption === "blur")
      await page.evaluate(() => window.dispatchEvent(new Event("blur")));
    else if (interruption === "secondary pointer")
      await page.locator(".library-brand-header").dispatchEvent("pointerdown", {
        pointerType: "touch",
        pointerId: 5,
        isPrimary: false,
      });
    else if (interruption === "replacement pointer")
      await page.locator(".library-brand-header").dispatchEvent("pointerdown", {
        pointerType: "mouse",
        pointerId: 7,
        isPrimary: true,
      });
    else if (interruption === "background")
      await page.evaluate(() => {
        Object.defineProperty(document, "hidden", {
          configurable: true,
          value: true,
        });
        document.dispatchEvent(new Event("visibilitychange"));
      });
    else if (interruption === "overlay ownership")
      await page.locator(".content-shell").evaluate((el) => {
        el.inert = true;
      });
    else
      await hit.dispatchEvent("lostpointercapture", {
        pointerType: "touch",
        pointerId: 4,
      });
    await page.waitForTimeout(650); // Beyond the hold threshold: interrupted work must stay cancelled.
    if (interruption === "background")
      await page.evaluate(() => {
        Object.defineProperty(document, "hidden", {
          configurable: true,
          value: false,
        });
        document.dispatchEvent(new Event("visibilitychange"));
      });
    if (interruption === "overlay ownership")
      await page.locator(".content-shell").evaluate((el) => {
        el.inert = false;
      });
    await hit.dispatchEvent("pointerup", {
      pointerType: "touch",
      pointerId: 4,
    });
    await hit.dispatchEvent("click", { detail: 1 });
    await hit.dispatchEvent("contextmenu", { pointerType: "touch" });
    await expect(page.locator(".selection-toolbar")).toHaveCount(0);
    await expect(page.locator(".mini-player")).toHaveCount(0);
    if (interruption === "blur") {
      await hit.focus();
      await hit.press("Enter");
      await expect(page.locator(".mini-player")).toBeVisible();
    }
  });
}

test("Library swipe interrupted by window blur cannot switch tabs on a late pointerup", async ({
  page,
}) => {
  await library(page);
  const surface = page.locator(".content-shell");
  await surface.dispatchEvent("pointerdown", {
    isPrimary: true,
    pointerType: "touch",
    pointerId: 8,
    clientX: 330,
    clientY: 400,
  });
  await surface.dispatchEvent("pointermove", {
    pointerType: "touch",
    pointerId: 8,
    clientX: 160,
    clientY: 400,
  });
  await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  await surface.dispatchEvent("pointerup", {
    pointerType: "touch",
    pointerId: 8,
    clientX: 60,
    clientY: 400,
  });
  await expect(
    page.getByRole("tab", { name: "Songs", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
});

test("real touch mini-player drag opens only on upward intent and cancellation leaves it usable", async ({
  page,
  context,
}) => {
  await library(page);
  await page.locator("#library-content .track-hit").first().click();
  await page
    .locator(".mobile-mini-play")
    .getByRole("button", { name: "Pause", exact: true })
    .click();
  const mini = page.locator(".mini-track"),
    cdp = await context.newCDPSession(page);
  const b = (await mini.boundingBox())!,
    x = b.x + b.width / 2,
    y = b.y + b.height / 2;
  const touch = (type: string, dx = 0, dy = 0) =>
    cdp.send("Input.dispatchTouchEvent", {
      type,
      touchPoints:
        type === "touchEnd" || type === "touchCancel"
          ? []
          : [{ x: x + dx, y: y + dy }],
    });
  await touch("touchStart");
  await touch("touchMove", -80);
  await touch("touchEnd");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await touch("touchStart");
  await touch("touchCancel");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await touch("touchStart");
  await touch("touchMove", 0, -55);
  await touch("touchEnd");
  await expect(
    page.getByRole("dialog", { name: "Now playing", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await mini.tap();
  await expect(
    page.getByRole("dialog", { name: "Now playing", exact: true }),
  ).toBeVisible();
});

test("mini-player horizontal drag does not open Now Playing; a subsequent tap still does", async ({
  page,
}) => {
  await library(page);
  await page.locator("#library-content .track-hit").first().click();
  await page
    .locator(".mobile-mini-play")
    .getByRole("button", { name: "Pause", exact: true })
    .click();
  const mini = page.locator(".mini-track");
  await mini.dispatchEvent("pointerdown", {
    pointerType: "touch",
    pointerId: 9,
    isPrimary: true,
    button: 0,
    clientX: 250,
    clientY: 700,
  });
  await mini.dispatchEvent("pointermove", {
    pointerType: "touch",
    pointerId: 9,
    clientX: 90,
    clientY: 700,
  });
  await mini.dispatchEvent("pointerup", {
    pointerType: "touch",
    pointerId: 9,
    clientX: 90,
    clientY: 700,
  });
  await mini.dispatchEvent("click", { detail: 1 });
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await mini.click();
  await expect(
    page.getByRole("dialog", { name: "Now playing", exact: true }),
  ).toBeVisible();
});
