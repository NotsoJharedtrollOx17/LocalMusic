import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { openSound, openSettings } from "./navigationHelpers";
import { holdRepeatingTone } from "./personalSessionFixture";

test("setup keeps two channel charts and answer actions reachable while tones repeat", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const start = AudioBufferSourceNode.prototype.start;
    (window as any).setupPulseCount = 0;
    AudioBufferSourceNode.prototype.start = function (...args) {
      (window as any).setupPulseCount++;
      return start.apply(this, args);
    };
  });
  await page.goto("/");
  const sound = await openSound(page, "adapt");
  await sound
    .getByRole("button", { name: "Create personal profile", exact: true })
    .click();
  await expect(sound.locator(".setup-preparation li")).toHaveCount(3);
  await expect(
    sound.getByRole("button", { name: "Begin", exact: true }),
  ).toBeDisabled();
  await page.screenshot({
    path: "artifacts/adapt-review/preparation-desktop.png",
  });
  await sound.getByRole("checkbox", { name: /I am using headphones/ }).check();
  await sound.getByRole("button", { name: "Begin", exact: true }).click();
  await expect
    .poll(() => page.evaluate(() => (window as any).setupPulseCount))
    .toBe(1);
  await expect(sound.locator(".setup-channel")).toHaveCount(2);
  await expect(sound.locator(".setup-gain")).toHaveCount(12);
  const chartTops = await sound
    .locator(".setup-channel-bars")
    .evaluateAll((nodes) =>
      nodes.map((node) => node.getBoundingClientRect().top),
    );
  expect(chartTops[0]).toBe(chartTops[1]);
  await expect(sound.getByRole("slider")).toHaveCount(0);
  await expect(sound.getByRole("progressbar")).toHaveAttribute("value", "0");
  await expect(
    sound.getByRole("button", { name: /Play tone|Listen again/ }),
  ).toHaveCount(0);
  await expect(sound.locator(".setup-question h3")).toHaveText(
    "Can you hear the beeps?",
  );
  await expect(
    sound.getByRole("button", { name: "Heard it", exact: true }),
  ).toBeEnabled();
  await page.evaluate(() => {
    const root = document.querySelector(".personal-wizard")!;
    (window as any).repeatUiChanges = [];
    const observer = new MutationObserver(() => {
      const heading = root.querySelector(".setup-question h3")?.textContent;
      const disabled = [...root.querySelectorAll(".setup-answers button")].some(
        (button) => (button as HTMLButtonElement).disabled,
      );
      if (heading !== "Can you hear the beeps?" || disabled)
        (window as any).repeatUiChanges.push({ heading, disabled });
    });
    observer.observe(root, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: ["disabled"],
    });
    (window as any).stopRepeatObserver = () => observer.disconnect();
  });
  await expect
    .poll(() => page.evaluate(() => (window as any).setupPulseCount), {
      timeout: 15000,
    })
    .toBeGreaterThanOrEqual(3);
  await page.evaluate(() => (window as any).stopRepeatObserver());
  expect(await page.evaluate(() => (window as any).repeatUiChanges)).toEqual(
    [],
  );
  await expect(sound).toContainText("Step 1/36"); // silence does not invent an answer
  for (const viewport of [
    { width: 1280, height: 720 },
    { width: 390, height: 700 },
    { width: 320, height: 640 },
  ]) {
    await page.setViewportSize(viewport);
    await expect(
      sound.getByRole("button", { name: "Not heard", exact: true }),
    ).toBeInViewport();
    await expect(
      sound.getByRole("button", { name: "Heard it", exact: true }),
    ).toBeInViewport();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(viewport.width);
    await page.screenshot({
      path: `artifacts/adapt-review/listening-${viewport.width}.png`,
    });
  }
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(sound.locator(".setup-gain > span").first()).toHaveCSS(
    "transition-duration",
    "0s",
  );
  expect(
    (await new AxeBuilder({ page }).include(".modal").analyze()).violations,
  ).toEqual([]);
  await sound.getByRole("button", { name: "Heard it", exact: true }).click();
  await expect(sound).toContainText("Step 2/36");
  await sound.getByRole("button", { name: "Stop setup", exact: true }).click();
  await expect(sound).toContainText("No partial profile was saved");
  const pulses = await page.evaluate(() => (window as any).setupPulseCount);
  await page.waitForTimeout(5500);
  expect(await page.evaluate(() => (window as any).setupPulseCount)).toBe(
    pulses,
  );
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  const settings = await openSettings(page);
  await settings.getByRole("button", { name: "Dark", exact: true }).click();
  await settings.getByRole("button", { name: "Español", exact: true }).click();
  await page.keyboard.press("Escape");
  const spanish = await openSound(page, "adapt");
  await spanish
    .getByRole("button", { name: "Crear perfil personal", exact: true })
    .click();
  await expect(spanish.locator(".setup-preparation li")).toHaveCount(3);
  await page.screenshot({
    path: "artifacts/adapt-review/preparation-spanish-dark.png",
  });
});

test("an answer during delayed automatic repeat IPC is retained and sent once", async ({
  page,
}) => {
  await holdRepeatingTone(page);
  await page.goto("/");
  const sound = await openSound(page, "adapt");
  await sound
    .getByRole("button", { name: "Create personal profile", exact: true })
    .click();
  await sound.getByRole("checkbox", { name: /I am using headphones/ }).check();
  await sound.getByRole("button", { name: "Begin", exact: true }).click();
  await expect
    .poll(() => page.evaluate(() => (window as any).repeatHeld))
    .toBe(true);
  await expect(sound.locator(".setup-question h3")).toHaveText(
    "Can you hear the beeps?",
  );
  await sound.getByRole("button", { name: "Not heard", exact: true }).click();
  await expect(sound).toContainText("Answer recorded");
  await expect(
    sound.locator(".setup-channel").first().locator('[data-frequency="1000"]'),
  ).toHaveAttribute("data-status", "untested");
  await page.evaluate(() => (window as any).releaseTone());
  await expect
    .poll(() => page.evaluate(() => (window as any).responses))
    .toEqual([false]);
  await expect(
    sound.locator(".setup-channel").first().locator('[data-frequency="1000"]'),
  ).toHaveAttribute("data-estimate", "-42");
  await expect(
    sound.getByRole("button", { name: "Heard it", exact: true }),
  ).toBeEnabled();
  await sound.getByRole("button", { name: "Stop setup", exact: true }).click();
  await expect(sound).toContainText("No partial profile was saved");
});
