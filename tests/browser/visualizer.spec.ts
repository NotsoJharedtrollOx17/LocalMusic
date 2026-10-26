import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { taggedWav } from "./fixtures";

async function open(page: Page) {
  await page.addInitScript(() => {
    const original = Worker;
    const state = {
      created: 0,
      terminated: 0,
      frames: [] as any[],
      workers: [] as Worker[],
    };
    (window as any).__visualTest = state;
    window.Worker = class extends original {
      constructor(url: string | URL, options?: WorkerOptions) {
        super(url, options);
        if (String(url).includes("analysis.worker")) {
          state.created++;
          state.workers.push(this);
          this.addEventListener("message", ({ data }) => {
            state.frames.push({ ...data, received: performance.now() });
            if (state.frames.length > 100) state.frames.shift();
          });
        }
      }
      terminate() {
        state.terminated++;
        super.terminate();
      }
    };
  });
  await page.goto("/");
  await page
    .locator('input[type="file"]')
    .first()
    .setInputFiles({
      name: "Visualizer.wav",
      mimeType: "audio/wav",
      buffer: taggedWav("Visualizer fixture", 1, 120),
    });
  await expect(page.locator(".track-row")).toHaveCount(1);
  await page
    .locator(".track-row")
    .getByRole("button", { name: /^Play / })
    .click();
  await page.locator(".mini-track").click();
  const player = page.getByRole("dialog", { name: "Now playing", exact: true });
  await player.getByRole("button", { name: "Player options" }).click();
  await page.getByRole("menuitem", { name: "Visualizer", exact: true }).click();
  const view = page.getByRole("dialog", { name: "Visualizer", exact: true });
  await expect(view).toBeVisible();
  return view;
}
test("real post-EQ analysis, modes, seek, pause, blur and focus return", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const view = await open(page);
  await expect(
    view.getByRole("button", { name: "Spectrum", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as any).__visualTest.frames.filter((f: any) => f.rms > 0.01)
            .length,
      ),
    )
    .toBeGreaterThan(3);
  expect(
    await page.evaluate(() => {
      const f = (window as any).__visualTest.frames.at(-1);
      return {
        bands: f.spectrum.length,
        wave: f.waveform.length,
        peak: Math.max(...f.spectrum),
      };
    }),
  ).toEqual({ bands: 64, wave: 256, peak: expect.any(Number) });
  await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  await expect(view).toBeVisible();
  await expect(
    view.getByRole("button", { name: "Pause", exact: true }),
  ).toBeVisible();
  for (const name of ["Geometry", "XMB wave", "Spectrum"]) {
    await view.getByRole("button", { name, exact: true }).click();
    await page.screenshot({
      path: `artifacts/visualizer-${name.split(" ")[0].toLowerCase()}.png`,
    });
  }
  const canvas = await view.locator("canvas").evaluate((c) => ({
    w: (c as HTMLCanvasElement).width,
    h: (c as HTMLCanvasElement).height,
  }));
  expect(canvas.w * canvas.h).toBeLessThanOrEqual(2_000_000);
  await view.getByRole("slider").focus();
  await page.keyboard.press("ArrowRight");
  await view.getByRole("button", { name: "Pause", exact: true }).click();
  await page.waitForTimeout(200);
  const count = await page.evaluate(
    () => (window as any).__visualTest.frames.length,
  );
  await page.waitForTimeout(200);
  expect(
    await page.evaluate(() => (window as any).__visualTest.frames.length),
  ).toBeLessThanOrEqual(count + 1);
  await page.keyboard.press("Escape");
  await expect(view).toHaveCount(0);
  await expect(
    page.getByRole("dialog", { name: "Now playing", exact: true }),
  ).toBeVisible();
  await expect(page.locator("[data-player-menu]")).toBeFocused();
  expect(
    await page.evaluate(() => (window as any).__visualTest.terminated),
  ).toBe(1);
  expect(errors).toEqual([]);
});

test("frequency colors and every scene follow live light/dark theme changes without restarting capture", async ({
  page,
}) => {
  const view = await open(page);
  for (const theme of ["light", "dark"]) {
    await page.emulateMedia({ colorScheme: theme as "light" | "dark" });
    for (const name of ["Spectrum", "Geometry", "XMB wave"]) {
      await view.getByRole("button", { name, exact: true }).click();
      await expect
        .poll(() =>
          view.locator("canvas").evaluate((node) => {
            const c = node as HTMLCanvasElement;
            return Array.from(
              c.getContext("2d")!.getImageData(0, 0, 1, 1).data,
            ).slice(0, 3);
          }),
        )
        .toEqual(theme === "light" ? [250, 248, 244] : [20, 22, 21]);
      if (name === "Spectrum") {
        const colors = await view.locator("canvas").evaluate((node) => {
          const c = node as HTMLCanvasElement,
            ctx = c.getContext("2d")!;
          const sample = (band: number) =>
            Array.from(
              ctx.getImageData(
                Math.floor(c.width * (0.08 + ((band + 0.25) * 0.84) / 64)),
                Math.floor(c.height * 0.76 - 1),
                1,
                1,
              ).data,
            );
          return [sample(0), sample(63)];
        });
        expect(colors[0][0]).toBeGreaterThan(colors[0][2]);
        expect(colors[1][2]).toBeGreaterThan(colors[1][0]);
      }
      await page.screenshot({
        path: `artifacts/visualizer-refined-${theme}-${name.split(" ")[0]}.png`,
      });
      expect(
        (await new AxeBuilder({ page }).include(".visualizer-view").analyze())
          .violations,
      ).toEqual([]);
    }
  }
  expect(await page.evaluate(() => (window as any).__visualTest.created)).toBe(
    1,
  );
});
test("worker failure retries, hidden view stops and resume starts a fresh generation", async ({
  page,
}) => {
  const view = await open(page);
  await expect
    .poll(() => page.evaluate(() => (window as any).__visualTest.frames.length))
    .toBeGreaterThan(2);
  await page.evaluate(() => {
    (window as any).__visualTest.workers
      .at(-1)
      .dispatchEvent(new ErrorEvent("error"));
  });
  await expect(
    view.getByRole("button", { name: "Try again", exact: true }),
  ).toBeVisible();
  await expect(
    view.getByRole("button", { name: "Pause", exact: true }),
  ).toBeVisible();
  await view.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(
    view.getByRole("button", { name: "Back", exact: true }),
  ).toBeFocused();
  await expect
    .poll(() => page.evaluate(() => (window as any).__visualTest.created))
    .toBe(2);
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: true,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect
    .poll(() => page.evaluate(() => (window as any).__visualTest.terminated))
    .toBe(2);
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: false,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect
    .poll(() => page.evaluate(() => (window as any).__visualTest.created))
    .toBe(3);
  await page.keyboard.press("Escape");
});
test("reduced motion, narrow layout, accessible controls and remembered mode without auto-opening", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce", colorScheme: "dark" });
  await page.setViewportSize({ width: 320, height: 480 });
  const view = await open(page);
  await expect(
    view.getByRole("button", { name: "Animate this session" }),
  ).toBeVisible();
  await expect
    .poll(() =>
      view
        .locator("canvas")
        .evaluate((c) =>
          Array.from(
            (c as HTMLCanvasElement).getContext("2d")!.getImageData(0, 0, 1, 1)
              .data,
          ).slice(0, 3),
        ),
    )
    .toEqual([20, 22, 21]);
  const animate = view.getByRole("button", { name: "Animate this session" });
  for (const colorScheme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme });
    await page.mouse.move(0, 0);
    await expect
      .poll(() =>
        animate.evaluate((button) => {
          const actual = getComputedStyle(button);
          return { color: actual.color, background: actual.backgroundColor };
        }),
      )
      .toEqual(
        colorScheme === "light"
          ? { color: "rgb(27, 27, 26)", background: "rgb(255, 253, 249)" }
          : { color: "rgb(242, 240, 232)", background: "rgb(29, 32, 30)" },
      );
    await animate.hover();
    await expect
      .poll(() =>
        animate.evaluate((button) => getComputedStyle(button).backgroundColor),
      )
      .toBe(colorScheme === "light" ? "rgb(241, 238, 231)" : "rgb(37, 41, 35)");
    expect(
      (await new AxeBuilder({ page }).include(".visualizer-view").analyze())
        .violations,
    ).toEqual([]);
    await page.mouse.move(0, 0);
    await page.screenshot({
      path: `artifacts/visualizer-animate-${colorScheme}.png`,
    });
  }
  await view.getByRole("button", { name: "XMB wave", exact: true }).click();
  const result = await new AxeBuilder({ page })
    .include(".visualizer-view")
    .analyze();
  expect(result.violations).toEqual([]);
  expect(
    await view.evaluate((node) => node.scrollWidth <= node.clientWidth),
  ).toBe(true);
  await view.getByRole("button", { name: "Animate this session" }).click();
  await page.keyboard.press("Escape");
  await page.reload();
  await expect(page.locator(".visualizer-view")).toHaveCount(0);
  expect(await page.evaluate(() => (window as any).__visualTest.created)).toBe(
    0,
  );
  await page.locator(".mini-track").click();
  await page.locator("[data-player-menu]").click();
  await page.getByRole("menuitem", { name: "Visualizer", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "XMB wave", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByRole("button", { name: "Animate this session" }),
  ).toBeVisible();
});
