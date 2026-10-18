import { test, expect, type Page, type Locator } from "@playwright/test";
import { taggedWav } from "./fixtures";
import { delayedPlayback } from "./playbar-native-fixture";

test("small native seeks retain their target until fresh state replaces old polls", async ({
  page,
}) => {
  await delayedPlayback(page);
  await page.goto("/");
  const slider = page.locator(".mini-player").getByRole("slider");
  await expect(slider).toHaveValue("10000");
  for (const target of [10100, 9900]) {
    await page.evaluate(() => {
      const f = window as any;
      f.holdPoll = true;
      f.pollHeld = false;
      f.freshHeld = false;
      f.seekHeld = false;
    });
    await expect
      .poll(() => page.evaluate(() => (window as any).pollHeld))
      .toBe(true);
    await page.evaluate(() => {
      (window as any).holdFresh = true;
    });
    await slider.fill(String(target));
    await expect
      .poll(() => page.evaluate(() => (window as any).seekHeld))
      .toBe(true);
    await page.evaluate(() => (window as any).releaseSeek());
    await expect
      .poll(() => page.evaluate(() => (window as any).freshHeld))
      .toBe(true);
    await page.evaluate(() => (window as any).releasePoll());
    await expect(slider).toHaveValue(String(target));
    await page.waitForTimeout(150);
    await expect(slider).toHaveValue(String(target));
    await page.evaluate(() => (window as any).releaseFresh());
    await page.waitForTimeout(150);
    await expect(slider).toHaveValue(String(target));
  }
});

test("compact and expanded players share the same thin track and circular thumb", async ({
  page,
}) => {
  await start(page);
  const mini = page.locator(".mini-player").getByRole("slider");
  const appearance = (slider: Locator) =>
    slider.evaluate((node) => {
      const css = getComputedStyle(node);
      return {
        height: css.height,
        backgroundSize: css.backgroundSize,
        backgroundRepeat: css.backgroundRepeat,
      };
    });
  const compact = await appearance(mini);
  expect(compact.height).toBe("16px");
  expect(compact.backgroundSize).toBe("100% 3px");
  expect(compact.backgroundRepeat).toBe("no-repeat");
  await page
    .locator(".mini-player")
    .getByRole("button", { name: "Now playing", exact: true })
    .click();
  const expanded = page
    .getByRole("dialog", { name: "Now playing", exact: true })
    .getByRole("slider");
  await expect(expanded).toBeVisible();
  expect(await appearance(expanded)).toEqual(compact);
  await expect(page.locator(".toast")).toHaveCount(0);
  await page.screenshot({ path: "artifacts/playbar-consistent-expanded.png" });
});

async function start(page: Page) {
  await page.addInitScript(() => {
    const property = Object.getOwnPropertyDescriptor(
      HTMLMediaElement.prototype,
      "currentTime",
    )!;
    (window as any).scrubSeeks = [];
    Object.defineProperty(HTMLMediaElement.prototype, "currentTime", {
      ...property,
      set(value: number) {
        (window as any).scrubSeeks.push(value);
        property.set!.call(this, value);
      },
    });
  });
  await page.goto("/");
  await page
    .locator("input[type=file]")
    .first()
    .setInputFiles(
      ["First", "Second"].map((title, i) => ({
        name: title + ".wav",
        mimeType: "audio/wav",
        buffer: taggedWav(title, i, 40),
      })),
    );
  await page.getByRole("button", { name: "Play First", exact: true }).click();
  await expect(
    page
      .locator(".mini-player")
      .getByRole("button", { name: "Pause", exact: true }),
  ).toBeVisible();
  await expect
    .poll(async () =>
      Number(
        await page.locator(".mini-player").getByRole("slider").inputValue(),
      ),
    )
    .toBeGreaterThan(100);
  await page.evaluate(() => {
    (window as any).scrubSeeks = [];
  });
}
async function drag(page: Page, slider: Locator) {
  await slider.click({ trial: true });
  const box = (await slider.boundingBox())!;
  await page.mouse.move(box.x + box.width * 0.2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.75, box.y + box.height / 2, {
    steps: 20,
  });
  await expect(slider).toHaveValue(/^[23]\d{4}$/);
  expect(await page.evaluate(() => (window as any).scrubSeeks)).toEqual([]);
  return box;
}
test("compact and full player preview drags without seeking until release", async ({
  page,
}) => {
  await start(page);
  const mini = page.locator(".mini-player");
  const slider = mini.getByRole("slider");
  const box = await drag(page, slider);
  // Capture must also finish a drag released beyond the slider.
  await page.mouse.move(box.x + box.width * 0.75, box.y - 35);
  await page.mouse.up();
  await expect
    .poll(() => page.evaluate(() => (window as any).scrubSeeks.length))
    .toBe(1);
  expect(
    await page.evaluate(() => (window as any).scrubSeeks[0]),
  ).toBeGreaterThan(28);
  expect(await page.evaluate(() => (window as any).scrubSeeks[0])).toBeLessThan(
    32,
  );
  await expect(
    mini.getByRole("button", { name: "Pause", exact: true }),
  ).toBeVisible();
  await mini.getByRole("button", { name: "Pause", exact: true }).click();
  await mini.getByRole("button", { name: "Now playing", exact: true }).click();
  const player = page.getByRole("dialog", { name: "Now playing", exact: true });
  await page.evaluate(() => {
    (window as any).scrubSeeks = [];
  });
  await drag(page, player.getByRole("slider"));
  await page.mouse.up();
  await expect
    .poll(() => page.evaluate(() => (window as any).scrubSeeks.length))
    .toBe(1);
  await expect(
    player.getByRole("button", { name: "Play", exact: true }),
  ).toBeVisible();
});
test("cancelled drags and old-track gestures never seek; keyboard still commits", async ({
  page,
}) => {
  await start(page);
  const mini = page.locator(".mini-player"),
    slider = mini.getByRole("slider");
  await drag(page, slider);
  await page.keyboard.press("Escape");
  await page.mouse.up();
  expect(await page.evaluate(() => (window as any).scrubSeeks)).toEqual([]);
  await drag(page, slider);
  await slider.dispatchEvent("pointercancel");
  await page.mouse.up();
  expect(await page.evaluate(() => (window as any).scrubSeeks)).toEqual([]);
  await drag(page, slider);
  await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  await page.mouse.up();
  expect(await page.evaluate(() => (window as any).scrubSeeks)).toEqual([]);
  await drag(page, slider);
  await mini
    .getByRole("button", { name: "Next", exact: true })
    .evaluate((node) => (node as HTMLButtonElement).click());
  await expect(mini).toContainText("Second");
  await page.mouse.up();
  expect(await page.evaluate(() => (window as any).scrubSeeks)).toEqual([]);
  await mini.getByRole("button", { name: "Pause", exact: true }).click();
  await slider.focus();
  await page.keyboard.down("End");
  expect(await page.evaluate(() => (window as any).scrubSeeks)).toEqual([]);
  await page.keyboard.up("End");
  await expect
    .poll(() => page.evaluate(() => (window as any).scrubSeeks.length))
    .toBe(1);
});

test("touch scrubbing commits once after the finger lifts", async ({
  page,
}) => {
  await start(page);
  await page.setViewportSize({ width: 390, height: 760 });
  // Mobile mini player opens the full surface for its seek slider.
  await page.locator(".mini-track").click();
  const slider = page
    .getByRole("dialog", { name: "Now playing", exact: true })
    .getByRole("slider");
  await slider.click({ trial: true });
  const box = (await slider.boundingBox())!;
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setTouchEmulationEnabled", { enabled: true });
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: box.x + box.width * 0.2, y: box.y + box.height / 2 }],
  });
  for (let i = 3; i <= 8; i++)
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [
        { x: box.x + (box.width * i) / 10, y: box.y + box.height / 2 },
      ],
    });
  expect(await page.evaluate(() => (window as any).scrubSeeks)).toEqual([]);
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await expect
    .poll(() => page.evaluate(() => (window as any).scrubSeeks.length))
    .toBe(1);
  await cdp.detach();
});
