import { openSettings } from "./navigationHelpers";
import { test, expect } from "@playwright/test";
test.use({ timezoneId: "America/Los_Angeles" });

test("recap follows the device at startup and resume without a dropdown", async ({
  page,
}) => {
  await page.goto("/");
  await openSettings(page);
  const dialog = page.getByRole("dialog", { name: "Settings", exact: true });
  await expect(dialog.getByRole("combobox")).toHaveCount(0);
  await expect(dialog.locator("#time-zone-current")).toHaveCount(0);
  // Simulate the OS changing zones while the app is suspended.
  await page.evaluate(() => {
    const original = Intl.DateTimeFormat.prototype.resolvedOptions;
    Intl.DateTimeFormat.prototype.resolvedOptions = function () {
      return { ...original.call(this), timeZone: "America/New_York" };
    };
    window.dispatchEvent(new Event("focus"));
  });
  await expect(dialog.locator("#time-zone-current")).toHaveCount(0);
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          new Promise<string>((resolve, reject) => {
            const open = indexedDB.open("local-music-v1", 1);
            open.onsuccess = () => {
              const db = open.result;
              const request = db
                .transaction("settings")
                .objectStore("settings")
                .get("preferences");
              request.onsuccess = () => {
                resolve(request.result.timeZone);
                db.close();
              };
              request.onerror = () => reject(request.error);
            };
            open.onerror = () => reject(open.error);
          }),
      ),
    )
    .toBe("America/New_York");
  await dialog.getByRole("button", { name: "Dark", exact: true }).click();
  await expect(
    dialog.getByRole("button", { name: "Dark", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await dialog
    .getByRole("button", { name: "Espa\u00f1ol", exact: true })
    .click();
  await page.setViewportSize({ width: 390, height: 844 });
  const spanish = page.getByRole("dialog", { name: "Ajustes", exact: true });
  await expect(spanish.locator("#time-zone-current")).toHaveCount(0);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
  await page.screenshot({
    path: "artifacts/settings-device-time-zone-mobile.png",
  });
  await page.reload();
  await openSettings(page);
  // The previously synchronized New York value must give way to the current device zone.
  await expect(page.locator("#time-zone-current")).toHaveCount(0);
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          new Promise<string>((resolve) => {
            const request = indexedDB.open("local-music-v1", 1);
            request.onsuccess = () => {
              const db = request.result,
                read = db
                  .transaction("settings")
                  .objectStore("settings")
                  .get("preferences");
              read.onsuccess = () => {
                resolve(read.result.timeZone);
                db.close();
              };
            };
          }),
      ),
    )
    .toBe("America/Los_Angeles");
});

test("dismissed playback errors stay dismissed across native polls and recover", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const fixture = window as unknown as {
      isTauri: boolean;
      __TAURI_INTERNALS__: unknown;
      __TAURI_EVENT_PLUGIN_INTERNALS__: unknown;
      testError: string | null;
      polls: number;
    };
    fixture.testError = null;
    fixture.isTauri = true;
    fixture.polls = 0;
    const cover =
      "data:image/svg+xml," +
      encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" fill="#ee6b23"/></svg>',
      );
    const track = {
      id: "fixture",
      title: "Test track",
      artist: "Test artist",
      album: "Test album",
      genre: "",
      durationMs: 40000,
      sourceUri: "fixture",
      favorite: false,
      available: true,
      artworkUrl: cover,
    };
    fixture.__TAURI_EVENT_PLUGIN_INTERNALS__ = { unregisterListener: () => {} };
    fixture.__TAURI_INTERNALS__ = {
      transformCallback: () => 1,
      invoke: async (command: string) => {
        if (command === "get_settings")
          return {
            language: "en",
            theme: "light",
            timeZone: "America/Los_Angeles",
            historyEnabledSince: "2026-10-01T00:00:00Z",
            privacyRevision: 0,
          };
        if (command === "list_tracks") return { tracks: [track], total: 1 };
        if (command === "tracks_by_id") return [track];
        if (command === "resolve_cover") return cover;
        if (command === "list_playlists") return [];
        if (command === "playback_snapshot") {
          fixture.polls++;
          return {
            trackId: "fixture",
            playing: false,
            positionMs: 0,
            durationMs: 40000,
            queue: ["fixture"],
            queueIndex: 0,
            shuffle: false,
            repeat: "off",
            excluded: false,
            error: fixture.testError,
          };
        }
        if (command === "plugin:event|listen") return 1;
        return null;
      },
    };
  });
  await page.goto("/");
  await openSettings(page);
  await page.evaluate(() => {
    (window as unknown as { testError: string }).testError =
      "No audio output device is available";
  });
  const banner = page.locator(".error-banner");
  await expect(banner).toContainText("No audio output device is available");
  const dialog = page.getByRole("dialog", { name: "Settings", exact: true });
  await dialog
    .locator(".modal-head")
    .getByRole("button", { name: "Close", exact: true })
    .focus();
  await page.keyboard.press("Shift+Tab");
  await expect(
    banner.getByRole("button", { name: "Close", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(banner).toHaveCount(0);
  await expect(
    dialog
      .locator(".modal-head")
      .getByRole("button", { name: "Close", exact: true }),
  ).toBeFocused();
  const polls = await page.evaluate(
    () => (window as unknown as { polls: number }).polls,
  );
  await expect
    .poll(() =>
      page.evaluate(() => (window as unknown as { polls: number }).polls),
    )
    .toBeGreaterThan(polls + 2);
  await expect(banner).toHaveCount(0);
  await page.evaluate(() => {
    (window as unknown as { testError: string | null }).testError = null;
  });
  const recoveryPolls = await page.evaluate(
    () => (window as unknown as { polls: number }).polls,
  );
  await expect
    .poll(() =>
      page.evaluate(() => (window as unknown as { polls: number }).polls),
    )
    .toBeGreaterThan(recoveryPolls);
  await page.evaluate(() => {
    (window as unknown as { testError: string }).testError =
      "No audio output device is available";
  });
  await expect(banner).toBeVisible();
  await banner.getByRole("button", { name: "Close", exact: true }).click();
  await expect(banner).toHaveCount(0);
  await expect(dialog).toBeVisible();
  await dialog
    .locator(".modal-head")
    .getByRole("button", { name: "Close", exact: true })
    .click();
  await page.locator(".mini-track").click();
  await page
    .locator(".player-track-actions")
    .getByRole("button", { name: "Track actions", exact: true })
    .click();
  await page
    .getByRole("menuitem", { name: "Track details", exact: true })
    .click();
  const details = page.getByRole("dialog", {
    name: "Track details",
    exact: true,
  });
  await page.evaluate(() => {
    (window as unknown as { testError: string }).testError =
      "Another audio output failure";
  });
  await expect(banner).toBeVisible();
  await details
    .locator(".modal-head")
    .getByRole("button", { name: "Close", exact: true })
    .focus();
  await page.keyboard.press("Shift+Tab");
  await expect(
    banner.getByRole("button", { name: "Close", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(banner).toHaveCount(0);
  await expect(
    details
      .locator(".modal-head")
      .getByRole("button", { name: "Close", exact: true }),
  ).toBeFocused();
});
