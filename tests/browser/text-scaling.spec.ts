import { test, expect, type Page } from "@playwright/test";
import { openSettings } from "./navigationHelpers";

/** Exercise font-only enlargement; browser OS-scale emulation may leave px text unchanged. */
async function enlargeText(page: Page) {
  await page.evaluate(() => {
    const nodes = [...document.querySelectorAll<HTMLElement>("body *")].filter(
      (el) =>
        el instanceof HTMLElement &&
        !el.dataset.fontScaled &&
        ([...el.childNodes].some(
          (n) => n.nodeType === Node.TEXT_NODE && n.textContent?.trim(),
        ) ||
          el.matches("input,textarea,select")),
    );
    const sizes = nodes.map((el) => parseFloat(getComputedStyle(el).fontSize));
    nodes.forEach((el, i) => {
      el.style.fontSize = `${sizes[i] * 2}px`;
      el.dataset.fontScaled = "true";
    });
  });
}

for (const width of [320, 390])
  test(`200% text keeps counts whole and appearance labels inside their controls at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/");
    await page
      .getByRole("button", { name: "Explore with sample audio", exact: true })
      .click();
    await expect(page.locator(".track-row")).toHaveCount(8);
    await page.evaluate(() => document.fonts.ready);
    const title = page.locator(".track-copy strong").first();
    const height = () =>
      title.evaluate((el) => {
        const range = document.createRange();
        range.selectNodeContents(el);
        return range.getBoundingClientRect().height;
      });
    const before = await height();
    await enlargeText(page);
    expect(await height()).toBeGreaterThanOrEqual(before * 1.8);
    const lines = await page.locator(".collection-count").evaluate((el) => {
      const range = document.createRange();
      range.selectNodeContents(el);
      return range.getClientRects().length;
    });
    expect(lines).toBe(1);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth - innerWidth,
      ),
    ).toBeLessThanOrEqual(1);
    const settings = await openSettings(page);
    await enlargeText(page);
    await settings
      .getByRole("button", { name: "Español", exact: true })
      .click();
    await enlargeText(page);
    for (const button of await page.locator(".settings-choice button").all()) {
      expect(
        await button.evaluate((el) => el.scrollWidth - el.clientWidth),
      ).toBeLessThanOrEqual(1);
      expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    }
    await page.getByRole("button", { name: "Oscuro", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Oscuro", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth - innerWidth,
      ),
    ).toBeLessThanOrEqual(1);
  });
