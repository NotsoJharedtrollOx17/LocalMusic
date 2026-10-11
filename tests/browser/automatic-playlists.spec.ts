import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { taggedWav } from "./fixtures";

test("automatic playlists stay live, preserve import order and play their derived queue", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("tab", { name: "Playlists", exact: true }).click();
  await expect(page.locator(".automatic-playlist-tile")).toHaveCount(4);
  const favorites = page
    .locator(".automatic-playlist-tile")
    .filter({ hasText: "Favorites" });
  await expect(favorites).toBeEnabled();
  await favorites.click();
  await expect(page.locator(".automatic-playlist-empty")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Play this mix", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Delete", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Playlists", exact: true }).click();
  const files = ["Alpha", "Beta", "Gamma"].map((title, i) => ({
    name: title + ".wav",
    mimeType: "audio/wav",
    buffer: taggedWav(title, i + 100, 40),
  }));
  await page.locator("input[type=file]").first().setInputFiles(files);
  const added = page
    .locator(".automatic-playlist-tile")
    .filter({ hasText: "Recently added" });
  await expect(added).toContainText("3 tracks");
  await added.click();
  await expect(page.locator(".track-row .track-copy strong")).toHaveText([
    "Gamma",
    "Beta",
    "Alpha",
  ]);
  await page.locator("input[type=file]").first().setInputFiles(files[0]);
  await expect(
    page.locator(".toast").filter({ hasText: "1 tracks imported" }),
  ).toBeVisible();
  await expect(page.locator(".track-row .track-copy strong")).toHaveText([
    "Gamma",
    "Beta",
    "Alpha",
  ]);
  const alpha = page
    .locator(".track-row")
    .filter({ has: page.getByText("Alpha", { exact: true }) });
  await alpha.getByRole("button", { name: "Favorite", exact: true }).click();
  await page.getByRole("button", { name: "Playlists", exact: true }).click();
  await expect(favorites).toContainText("1 track");
  await favorites.click();
  await expect(page.locator(".track-row .track-copy strong")).toHaveText([
    "Alpha",
  ]);
  await page
    .getByRole("button", { name: "Play this mix", exact: true })
    .click();
  await expect(page.locator(".mini-player")).toContainText("Alpha");
  // Cross the automatic refresh interval while real fixture audio is playing.
  await page.waitForTimeout(6500);
  await page
    .locator(".mini-player")
    .getByRole("button", { name: "Pause", exact: true })
    .click();
  await page
    .locator(".track-row")
    .getByRole("button", { name: "Favorite", exact: true })
    .click();
  await expect(page.locator(".automatic-playlist-empty")).toBeVisible();
  const playedMs = await page.evaluate(
    () =>
      new Promise<number>((resolve) => {
        const request = indexedDB.open("local-music-v1", 1);
        request.onsuccess = () => {
          const db = request.result,
            read = db.transaction("sessions").objectStore("sessions").getAll();
          read.onsuccess = () => {
            resolve(read.result.reduce((sum, s) => sum + s.playedMs, 0));
            db.close();
          };
        };
      }),
  );
  expect(playedMs).toBeGreaterThan(5000);
  await page.getByRole("button", { name: "Playlists", exact: true }).click();
  await expect(
    page
      .locator(".automatic-playlist-tile")
      .filter({ hasText: "Recently played" }),
  ).toContainText("1 track");
  await page.reload();
  await page.getByRole("tab", { name: "Playlists", exact: true }).click();
  await added.click();
  await expect(page.locator(".track-row .track-copy strong")).toHaveText([
    "Gamma",
    "Beta",
    "Alpha",
  ]);
});

test("automatic history ranking excludes private music and localizes without changing membership", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Explore with sample audio" }).click();
  await expect(page.locator(".track-row")).toHaveCount(8);
  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const request = indexedDB.open("local-music-v1", 1);
        request.onsuccess = () => {
          const db = request.result,
            tx = db.transaction(
              ["tracks", "sessions", "intervals"],
              "readwrite",
            ),
            tracks = tx.objectStore("tracks"),
            read = tracks.getAll();
          read.onsuccess = () => {
            const songs = read.result;
            songs.slice(0, 3).forEach((track, i) =>
              tracks.put(
                {
                  ...track,
                  demo: false,
                  title: ["Rank first", "Rank second", "Private song"][i],
                },
                track.id,
              ),
            );
            const records = [
              {
                id: "a1",
                trackId: songs[0].id,
                playedMs: 30000,
                startedAtUtc: "2026-01-01T00:00:00Z",
                excluded: false,
              },
              {
                id: "a2",
                trackId: songs[0].id,
                playedMs: 30000,
                startedAtUtc: "2026-01-02T00:00:00Z",
                excluded: false,
              },
              {
                id: "b",
                trackId: songs[1].id,
                playedMs: 90000,
                startedAtUtc: "2026-01-03T00:00:00Z",
                excluded: false,
              },
              {
                id: "private",
                trackId: songs[2].id,
                playedMs: 90000,
                startedAtUtc: "2026-01-06T00:00:00Z",
                excluded: true,
              },
              {
                id: "demo",
                trackId: songs[3].id,
                playedMs: 90000,
                startedAtUtc: "2026-01-06T00:00:00Z",
                excluded: false,
              },
            ];
            records.forEach((s) => tx.objectStore("sessions").put(s, s.id));
            tx.objectStore("intervals").put(
              {
                sessionId: "a1",
                sequence: 1,
                startUtc: "2026-01-05T00:00:00Z",
                playedMs: 1000,
              },
              "a1:1",
            );
          };
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
      }),
  );
  await page.getByRole("tab", { name: "Playlists", exact: true }).click();
  await page
    .locator(".automatic-playlist-tile")
    .filter({ hasText: "Most played" })
    .click();
  await expect(page.locator(".track-row .track-copy strong")).toHaveText([
    "Rank first",
    "Rank second",
  ]);
  await expect(
    page.getByRole("button", { name: "Edit", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByRole("button", { name: "Espa\u00f1ol", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Cerrar", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Más reproducidas", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".track-row .track-copy strong")).toHaveText([
    "Rank first",
    "Rank second",
  ]);
  await page.getByRole("button", { name: "Listas", exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator(".automatic-playlist-tile")).toHaveCount(4);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  const results = await new AxeBuilder({ page })
    .include(".automatic-playlists")
    .analyze();
  expect(results.violations).toEqual([]);
  await page.screenshot({
    path: "artifacts/automatic-playlists-mobile-es.png",
    fullPage: true,
  });
});
