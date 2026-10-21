import { test, expect } from "@playwright/test";
import { taggedWav } from "./fixtures";
import { openSettings } from "./navigationHelpers";
import { holdNextTrackRead, release } from "./catalog-gate";

test("tab changes never flash a bare title and retain known totals during refresh", async ({
  page,
}) => {
  await page.goto("/");
  const count = page.locator(".collection-count");
  await expect(count).toHaveText("0 songs");
  await page.evaluate(() => {
    const state = window as unknown as { bareCountTitles: string[] };
    state.bareCountTitles = [];
    new MutationObserver(() => {
      const text = document
        .querySelector(".collection-count")
        ?.textContent?.trim();
      if (text && ["Songs", "Albums", "Artists", "Playlists"].includes(text))
        state.bareCountTitles.push(text);
    }).observe(document.body, {
      subtree: true,
      childList: true,
      characterData: true,
    });
  });
  await holdNextTrackRead(page);
  await page.getByRole("tab", { name: "Albums", exact: true }).click();
  await page.waitForFunction(
    () => (window as unknown as { catalogReadHeld: boolean }).catalogReadHeld,
  );
  await expect(count).toHaveAttribute("aria-busy", "true");
  expect((await count.textContent())?.trim()).toBe("");
  await release(page);
  await expect(count).toHaveText("0 albums");
  await page.getByRole("tab", { name: "Songs", exact: true }).click();
  await expect(count).toHaveText("0 songs");
  await holdNextTrackRead(page);
  await page.getByRole("tab", { name: "Albums", exact: true }).click();
  await page.waitForFunction(
    () => (window as unknown as { catalogReadHeld: boolean }).catalogReadHeld,
  );
  await expect(count).toHaveText("0 albums");
  await release(page);
  for (const [tab, text] of [
    ["Artists", "0 artists"],
    ["Playlists", "4 playlists"],
    ["Albums", "0 albums"],
    ["Songs", "0 songs"],
  ]) {
    await page.getByRole("tab", { name: tab, exact: true }).click();
    await expect(count).toHaveText(text);
  }
  expect(
    await page.evaluate(
      () =>
        (window as unknown as { bareCountTitles: string[] }).bareCountTitles,
    ),
  ).toEqual([]);
});

test("collection headings show their own totals without inactive buttons", async ({
  page,
}) => {
  await page.goto("/");
  const count = page.locator(".collection-count");
  await expect(count).toHaveText("0 songs");
  await page
    .locator('input[type="file"]')
    .first()
    .setInputFiles(
      ["Alpha", "Beta", "Gamma"].map((name, index) => ({
        name: `${name}.wav`,
        mimeType: "audio/wav",
        buffer: taggedWav(name, index + 1),
      })),
    );
  await expect(count).toHaveText("3 songs");
  await expect(page.locator(".filter-button")).toHaveCount(0);
  for (const [tab, text] of [
    ["Albums", "1 album"],
    ["Artists", "1 artist"],
    ["Playlists", "4 playlists"],
  ]) {
    await page.getByRole("tab", { name: tab, exact: true }).click();
    await expect(count).toHaveText(text);
    expect(await count.evaluate((n) => getComputedStyle(n).cursor)).toBe(
      "default",
    );
    await expect(count).not.toHaveAttribute("role", "button");
  }
  await page.getByRole("button", { name: "New playlist", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByLabel("Playlist name", { exact: true })
    .fill("Counter check");
  await dialog.getByRole("checkbox").first().check();
  await dialog.getByRole("button", { name: "Save", exact: true }).click();
  await expect(count).toHaveText("5 playlists");
  const settings = await openSettings(page);
  await settings.getByRole("button", { name: "Español", exact: true }).click();
  await page.keyboard.press("Escape");
  await page.setViewportSize({ width: 320, height: 844 });
  for (const [tab, text] of [
    ["Listas", "5 listas"],
    ["Artistas", "1 artista"],
    ["Álbumes", "1 álbum"],
    ["Canciones", "3 canciones"],
  ]) {
    await page.getByRole("tab", { name: tab, exact: true }).click();
    await expect(count).toHaveText(text);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(320);
  }
  await page
    .getByRole("button", { name: "Filtrar y ordenar", exact: true })
    .click();
  await page
    .getByRole("menuitemradio", { name: "Favoritas", exact: true })
    .click();
  await expect(count).toHaveText("Favoritas · 0 canciones");
  await count.click();
  await expect(page.locator(".empty-favorites")).toBeVisible();
  await expect(
    page
      .locator(".library-toolbar")
      .getByRole("button", { name: "Toda la música", exact: true }),
  ).toHaveCount(0);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(320);
  await page.screenshot({
    path: "artifacts/favorites-scope-review/collection-counts-es-320.png",
  });
});
