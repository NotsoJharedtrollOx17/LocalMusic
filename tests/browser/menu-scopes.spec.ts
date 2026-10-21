import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { taggedWav } from "./fixtures";
import { holdNextTrackRead, release } from "./catalog-gate";
import { openSettings } from "./navigationHelpers";

async function importTracks(page: Page, album = "Fixture Album") {
  await page.goto("/");
  await page
    .locator("input[type=file]")
    .first()
    .setInputFiles(
      ["Alpha", "Beta", "Gamma"].map((title, i) => ({
        name: title + ".wav",
        mimeType: "audio/wav",
        buffer: taggedWav(title, i + 1, 1, { album }),
      })),
    );
  await expect(page.locator(".track-row")).toHaveCount(3);
}
async function headerMenu(page: Page) {
  await page
    .getByRole("button", { name: "Library actions", exact: true })
    .click();
  return page.getByRole("menu");
}

test("collection Edit stays in scope, retains selection across dialogs and separates playlist editing", async ({
  page,
}) => {
  await importTracks(page);
  await page.getByRole("tab", { name: "Albums", exact: true }).click();
  await page.locator(".album-card").click();
  await expect(page.locator(".collection-hero h1")).toHaveText("Fixture Album");
  let menu = await headerMenu(page);
  await menu.getByRole("menuitem", { name: "Edit", exact: true }).click();
  await page
    .locator(".selection-toolbar")
    .getByRole("button", { name: "Select visible songs", exact: true })
    .click();
  await expect(page.locator(".selection-toolbar")).toContainText("3 selected");
  await page
    .locator(".selection-toolbar")
    .getByRole("button", { name: "Add to playlist", exact: true })
    .click();
  await page.keyboard.press("Escape");
  await expect(page.locator(".selection-toolbar")).toContainText("3 selected");
  await expect(page.locator(".collection-hero h1")).toHaveText("Fixture Album");
  menu = await headerMenu(page);
  await menu
    .getByRole("menuitem", { name: "Done selecting", exact: true })
    .click();
  await expect(page.locator(".selection-toolbar")).toHaveCount(0);
  await page
    .locator(".track-row")
    .first()
    .getByRole("button", { name: /^Track actions:/ })
    .click();
  await expect(
    page.getByRole("menuitem", { name: "Go to album", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("menuitem", { name: "Go to artist", exact: true })
    .click();
  await expect(page.locator(".collection-hero h1")).toHaveText(
    "Fixture Artist",
  );
  await page
    .locator(".artist-view")
    .getByRole("tab", { name: "Albums", exact: true })
    .click();
  menu = await headerMenu(page);
  await expect(menu.getByRole("menuitem")).toHaveText([
    "Sound options",
    "Settings",
  ]);
  await page.keyboard.press("Escape");
  await page
    .locator(".artist-view")
    .getByRole("tab", { name: "Songs", exact: true })
    .click();
  menu = await headerMenu(page);
  await menu.getByRole("menuitem", { name: "Edit", exact: true }).click();
  await page.locator(".track-row .selection-check").first().click();
  await expect(page.locator(".selection-toolbar")).toContainText("1 selected");
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Library", exact: true }).click();
  await page.getByRole("button", { name: "Library", exact: true }).click();
  await page.getByRole("tab", { name: "Playlists", exact: true }).click();
  await page
    .locator(".automatic-playlist-tile")
    .filter({ hasText: "Recently added" })
    .click();
  menu = await headerMenu(page);
  await menu.getByRole("menuitem", { name: "Edit", exact: true }).click();
  await expect(page.locator(".selection-toolbar")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Edit playlist", exact: true }),
  ).toHaveCount(0);
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Playlists", exact: true }).click();
  await page.getByRole("button", { name: "New playlist", exact: true }).click();
  const manual = page.getByRole("dialog", {
    name: "New playlist",
    exact: true,
  });
  await manual
    .getByLabel("Playlist name", { exact: true })
    .fill("My selection");
  await expect(manual.getByRole("checkbox")).toHaveCount(3);
  await manual.getByRole("checkbox").first().check();
  await manual.getByRole("button", { name: "Save", exact: true }).click();
  await page
    .locator(".playlist-tile")
    .filter({ hasText: "My selection" })
    .click();
  await page
    .getByRole("button", { name: "Edit playlist", exact: true })
    .click();
  menu = await headerMenu(page);
  await expect(menu.getByRole("menuitem")).toHaveText([
    "Sound options",
    "Settings",
  ]);
  await page.keyboard.press("Escape");
  await page
    .getByRole("button", { name: "Save playlist", exact: true })
    .click();
  menu = await headerMenu(page);
  await expect(
    menu.getByRole("menuitem", { name: "Edit", exact: true }),
  ).toBeVisible();
});

test("a delayed album navigation cannot overwrite a newer Songs choice", async ({
  page,
}) => {
  await importTracks(page);
  await page
    .locator(".track-row")
    .first()
    .getByRole("button", { name: /^Track actions:/ })
    .click();
  await holdNextTrackRead(page);
  await page
    .getByRole("menuitem", { name: "Go to album", exact: true })
    .click();
  await expect(
    page.getByRole("tab", { name: "Albums", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await page.getByRole("tab", { name: "Songs", exact: true }).click();
  await release(page);
  await expect(page.locator(".track-row")).toHaveCount(3);
  await expect(page.locator(".collection-hero")).toHaveCount(0);
  await expect(page.getByRole("menu")).toHaveCount(0);
  await expect(
    page.getByRole("tab", { name: "Songs", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
});

test("localized long collection names and menus remain usable in desktop and narrow views", async ({
  page,
}) => {
  const album =
    "Un álbum con un nombre muy largo para comprobar el orden y la lectura de los detalles";
  await importTracks(page, album);
  const settings = await openSettings(page);
  await settings.getByRole("button", { name: "Español", exact: true }).click();
  await settings
    .getByRole("button", { name: "Dark", exact: true })
    .or(settings.getByRole("button", { name: "Oscuro", exact: true }))
    .click();
  await page.keyboard.press("Escape");
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const width of [1280, 640, 390, 320]) {
    await page.setViewportSize({ width, height: 600 });
    await page
      .locator(".track-row")
      .first()
      .getByRole("button", { name: /^Acciones de la canción:/ })
      .click();
    const menu = page.getByRole("menu");
    await expect(menu.getByRole("menuitem")).toHaveText([
      "Añadir a una lista",
      "Detalles de la canción",
      "Ir al álbum",
      "Ir al artista",
      "Quitar de la biblioteca",
    ]);
    const box = (await menu.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(width);
    expect(box.y + box.height).toBeLessThanOrEqual(600);
    expect(
      (await new AxeBuilder({ page }).include(".action-menu").analyze())
        .violations,
    ).toEqual([]);
    await page.screenshot({
      path: `artifacts/context-menu-es-dark-${width}.png`,
    });
    await page.keyboard.press("Escape");
  }
  await page.getByRole("tab", { name: "Álbumes", exact: true }).click();
  await page.locator(".album-card").click();
  await expect(
    page.getByRole("heading", { name: album, exact: true }),
  ).toHaveCount(1);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(320);
  await page.screenshot({ path: "artifacts/context-collection-es-mobile.png" });
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test("album navigation distinguishes artists with the same album title", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .locator("input[type=file]")
    .first()
    .setInputFiles(
      ["First artist", "Second artist"].map((artist, i) => ({
        name: `Artist-${i}.wav`,
        mimeType: "audio/wav",
        buffer: taggedWav(`Track-${i}`, i + 20, 1, {
          artist,
          album: "Shared title",
        }),
      })),
    );
  await expect(page.locator(".track-row")).toHaveCount(2);
  const row = page.locator(".track-row").filter({ hasText: "Second artist" });
  await row.getByRole("button", { name: /^Track actions:/ }).click();
  await page
    .getByRole("menuitem", { name: "Go to album", exact: true })
    .click();
  await expect(page.locator(".collection-hero")).toContainText("Second artist");
  await expect(page.locator(".track-row .track-copy strong")).toHaveText([
    "Track-1",
  ]);
  await page
    .locator(".track-row")
    .getByRole("button", { name: /^Track actions:/ })
    .click();
  await expect(
    page.getByRole("menuitem", { name: "Go to album", exact: true }),
  ).toHaveCount(0);
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Library", exact: true }).click();
  await expect(
    page.getByRole("tab", { name: "Songs", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await expect(
    row.getByRole("button", { name: /^Track actions:/ }),
  ).toBeFocused();
});

test("unavailable audio keeps details without copy actions or invented destinations", async ({
  page,
}) => {
  await importTracks(page);
  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const request = indexedDB.open("local-music-v1", 1);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const db = request.result,
            tx = db.transaction("tracks", "readwrite");
          const store = tx.objectStore("tracks");
          const read = store.getAll();
          read.onsuccess = () => {
            for (const track of read.result)
              store.put(
                { ...track, available: false, album: "", artist: "" },
                track.id,
              );
          };
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => {
            db.close();
            reject(tx.error);
          };
        };
      }),
  );
  await page.reload();
  const row = page.locator(".track-row").first();
  await row.getByRole("button", { name: /^Track actions:/ }).click();
  await expect(page.getByRole("menuitem")).toHaveText([
    "Add to playlist",
    "Track details",
    "Remove from Library",
  ]);
  await expect(
    page.getByRole("menuitem", { name: /Save audio cop/ }),
  ).toHaveCount(0);
  await page
    .getByRole("menuitem", { name: "Track details", exact: true })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Track details", exact: true }),
  ).toBeVisible();
});
