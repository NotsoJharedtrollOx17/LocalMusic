import { test, expect, type Page } from "@playwright/test";
import { seedInlineCatalog } from "./inlineSearchFixture";
import { openSettings } from "./navigationHelpers";

async function seed(page: Page) {
  await seedInlineCatalog(page);
  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve) => {
      const request = indexedDB.open("local-music-v1");
      request.onsuccess = () => resolve(request.result);
    });
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("playlists", "readwrite");
      for (const [id, title] of [
        ["c1", "Recently played mix"],
        ["c2", "Recent"],
        ["c3", "A recent mix"],
        ["c4", "Favorites"],
      ]) {
        tx.objectStore("playlists").put(
          { id, title, kind: "manual", trackIds: ["entry-129"] },
          id,
        );
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  });
  await page.reload();
  await page.getByRole("tab", { name: "Playlists", exact: true }).click();
  await expect(page.locator("#library-content .collection-count")).toHaveText(
    "9 playlists",
  );
}

const ids = (page: Page) =>
  page
    .locator(".playlist-search-results [data-playlist-id]")
    .evaluateAll((nodes) =>
      nodes.map((n) => n.getAttribute("data-playlist-id")),
    );

test("playlist names filter immediately into one counted grid, custom matches first", async ({
  page,
}) => {
  await seed(page);
  await page
    .getByRole("button", { name: "Search your library", exact: true })
    .click();
  const input = page.getByRole("searchbox");
  await page.clock.install({ time: new Date("2026-10-31T12:00:00Z") });
  await page.clock.pauseAt(new Date("2026-10-31T12:00:01Z"));
  await input.fill("recent");
  // Timers stay paused: overview name filtering must not wait for the catalog debounce.
  await expect(page.locator("#library-content .collection-count")).toHaveText(
    "5 of 9 playlists",
  );
  expect(await ids(page)).toEqual([
    "c2",
    "c1",
    "c3",
    "automatic:recently-added",
    "automatic:recently-played",
  ]);
  await expect(
    page.getByRole("region", { name: "5 of 9 playlists", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".playlist-section-heading")).toHaveCount(0);
  await expect(page.locator("#library-content .generator")).toBeHidden();
  await expect(input).toBeFocused();
  await input.fill("favorites");
  await expect(page.locator("#library-content .collection-count")).toHaveText(
    "2 of 9 playlists",
  );
  expect(await ids(page)).toEqual(["c4", "automatic:favorites"]);
  const card = page.locator('.playlist-search-results [data-playlist-id="c4"]');
  await card.locator(".saved-playlist-menu").click();
  await expect(
    page.getByRole("menuitem", { name: "Rename playlist", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("menuitem", { name: "Delete playlist", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await page
    .getByRole("button", { name: "Search your library", exact: true })
    .click();
  await input.fill("no matching playlists");
  await expect(page.locator("#library-content .collection-count")).toHaveText(
    "0 of 9 playlists",
  );
  await expect(page.locator("#library-content .search-empty")).toBeVisible();
  await page.locator("#library-content [data-search-clear]").click();
  await page.clock.runFor(300);
  await expect(page.locator("#library-content .collection-count")).toHaveText(
    "9 playlists",
  );
  await expect(page.locator("#default-playlists-heading")).toBeVisible();
  await expect(page.locator("#saved-playlists-heading")).toBeVisible();
  await expect(page.locator("#library-content .generator")).toBeVisible();
  await input.fill("Favorites");
  await expect(page.locator("#library-content .collection-count")).toHaveText(
    "2 of 9 playlists",
  );
  await page.getByRole("tab", { name: "Songs", exact: true }).click();
  await page.clock.runFor(1);
  // Returning to catalog search starts immediately, rather than adding its debounce.
  await expect(page.locator("#library-content .collection-count")).toHaveText(
    "0 of 130 songs",
  );
});

test("localized defaults share the grid, respect name relevance and reflow in narrow dark UI", async ({
  page,
}) => {
  await seed(page);
  const settings = await openSettings(page);
  await settings
    .getByRole("button", { name: "Espa\u00f1ol", exact: true })
    .click();
  await settings.getByRole("button", { name: "Oscuro", exact: true }).click();
  await settings.getByRole("button", { name: "Cerrar", exact: true }).click();
  await page.setViewportSize({ width: 320, height: 700 });
  await page
    .getByRole("button", { name: "Buscar en tu biblioteca", exact: true })
    .click();
  const input = page.getByRole("searchbox");
  await input.fill("re");
  await expect(page.locator("#library-content .collection-count")).toHaveText(
    "6 de 9 listas",
  );
  const found = await ids(page);
  expect(found.slice(0, 3).every((id) => id?.startsWith("c"))).toBe(true);
  expect(found.slice(3)).toEqual([
    "automatic:recently-played",
    "automatic:recently-added",
    "automatic:most-played",
  ]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - innerWidth,
    ),
  ).toBeLessThanOrEqual(1);
  await page.screenshot({
    path: "artifacts/playlist-search-spanish-mobile.png",
    fullPage: true,
  });
  await page.locator('[data-playlist-id="automatic:recently-played"]').click();
  await expect(page.locator(".playlist-search-results")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Buscar en tu biblioteca", exact: true })
    .click();
  await expect(input).toHaveValue("");
});
