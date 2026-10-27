import { test, expect, type Page } from "@playwright/test";
import { taggedWav } from "./fixtures";
import { openSettings } from "./navigationHelpers";
async function stored(page: Page, store: string) {
  return page.evaluate(
    (store) =>
      new Promise<any[]>((resolve, reject) => {
        const r = indexedDB.open("local-music-v1");
        r.onsuccess = () => {
          const db = r.result,
            request = db.transaction(store).objectStore(store).getAll();
          request.onsuccess = () => {
            resolve(request.result);
            db.close();
          };
          request.onerror = () => reject(request.error);
        };
        r.onerror = () => reject(r.error);
      }),
    store,
  );
}
async function library(page: Page, seconds = 1) {
  await page.goto("/");
  await page
    .locator("input[type=file]")
    .first()
    .setInputFiles(
      Array.from({ length: 4 }, (_, i) => ({
        name: `Track ${i}.wav`,
        mimeType: "audio/wav",
        buffer: taggedWav(`Track ${i}`, i + 1, seconds, {
          artist: `Artist ${i}`,
          album: `Album ${i}`,
        }),
      })),
    );
  await expect(page.locator(".track-row")).toHaveCount(4);
}
test("player feedback Undo is keyboard reachable and stays visible while focused", async ({
  page,
}) => {
  await library(page, 8);
  await page
    .locator(".track-row")
    .first()
    .getByRole("button", { name: /^Play / })
    .click();
  await page
    .locator(".mini-player")
    .getByRole("button", { name: "Pause", exact: true })
    .click();
  await page.locator(".mini-track").click();
  const player = page.getByRole("dialog", { name: "Now playing", exact: true });
  await player
    .getByRole("button", { name: "Player options", exact: true })
    .click();
  await page
    .getByRole("menuitem", { name: "Suggest less", exact: true })
    .click();
  await expect(
    page.locator(".toast").getByRole("button", { name: "Undo", exact: true }),
  ).toBeVisible();
  await player.getByRole("button", { name: "Close", exact: true }).focus();
  await page.keyboard.press("Shift+Tab");
  const undo = page
    .locator(".toast")
    .getByRole("button", { name: "Undo", exact: true });
  await expect(undo).toBeFocused();
  await page.waitForTimeout(5000);
  await expect(undo).toBeFocused();
  await page.keyboard.press("Enter");
  await expect
    .poll(async () => (await stored(page, "suggestionLess")).length)
    .toBe(0);
  await expect(player).toBeVisible();
});
test("a delayed ranking cannot replace a preview after creator inputs change", async ({
  page,
}) => {
  await library(page);
  await page.getByRole("tab", { name: "Playlists", exact: true }).click();
  await page.evaluate(() => {
    const Original = window.Worker;
    const state = window as any;
    window.Worker = class extends Original {
      private ranking: boolean;
      constructor(url: string | URL, options?: WorkerOptions) {
        super(url, options);
        this.ranking = String(url).includes("rank.worker");
      }
      postMessage(value: any, transfer: any = []) {
        if (this.ranking && !state.rankingHeld) {
          state.rankingHeld = true;
          state.releaseRanking = () => super.postMessage(value, transfer);
        } else super.postMessage(value, transfer);
      }
    } as typeof Worker;
  });
  await page
    .getByRole("button", { name: "Generate playlist", exact: true })
    .click();
  await expect
    .poll(() => page.evaluate(() => (window as any).rankingHeld))
    .toBe(true);
  await page.getByLabel("Exclude artist", { exact: true }).fill("Artist 0");
  await page.evaluate(() => (window as any).releaseRanking());
  await expect(
    page.getByRole("button", { name: "Generate playlist", exact: true }),
  ).toBeEnabled();
  await expect(page.locator(".generated-result")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Generate playlist", exact: true })
    .click();
  await expect(page.locator(".generated-result")).toBeVisible();
  await expect(
    page.locator(".generated-result").getByText("Artist 0", { exact: true }),
  ).toHaveCount(0);
});
test("version-one browser storage upgrades without replacing music, playlists or preferences", async ({
  page,
}) => {
  await page.addInitScript(
    ({ audio }) => {
      const r = indexedDB.open("local-music-v1", 1);
      r.onupgradeneeded = () => {
        for (const name of [
          "tracks",
          "sessions",
          "intervals",
          "playlists",
          "settings",
          "snapshots",
        ])
          r.result.createObjectStore(name);
      };
      r.onsuccess = () => {
        const db = r.result;
        const tx = db.transaction(
          ["tracks", "playlists", "settings"],
          "readwrite",
        );
        tx.objectStore("tracks").put(
          {
            id: "legacy",
            title: "Legacy song",
            artist: "Legacy artist",
            album: "Album",
            genre: "Rock",
            durationMs: 1000,
            sourceUri: "browser-file:legacy",
            favorite: true,
            available: true,
            audioChannels: 1,
            file: new File([new Uint8Array(audio)], "legacy.wav", {
              type: "audio/wav",
            }),
          },
          "legacy",
        );
        tx.objectStore("playlists").put(
          {
            id: "saved",
            title: "Old playlist",
            kind: "manual",
            trackIds: ["legacy"],
          },
          "saved",
        );
        tx.objectStore("settings").put(
          {
            language: "en",
            theme: "dark",
            timeZone: "UTC",
            historyEnabledSince: "2025-01-01T00:00:00Z",
          },
          "preferences",
        );
        tx.oncomplete = () => db.close();
      };
    },
    { audio: [...taggedWav("Legacy song", 1, 1)] },
  );
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Play Legacy song", exact: true }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "Playlists", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Balanced", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.locator(".playlist-tile").filter({ hasText: "Old playlist" }),
  ).toBeVisible();
  const preferences = (await stored(page, "settings")).find((s) => s.language);
  expect(preferences.theme).toBe("dark");
  expect(preferences.historyEnabledSince).toBe("2025-01-01T00:00:00Z");
});
test("source analysis stays silent; feedback/Undo, stable saved preview and remembered blend", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await library(page);
  await page.waitForTimeout(3500);
  expect(await stored(page, "acousticFeatures")).toEqual([]);
  expect(await stored(page, "sessions")).toEqual([]);
  expect(await stored(page, "intervals")).toEqual([]);
  await page.getByRole("tab", { name: "Playlists", exact: true }).click();
  await expect(page.locator(".playlist-blend")).toContainText(
    "0 of 4 songs ready",
  );
  await expect(
    page.getByRole("spinbutton", { name: "Count", exact: true }),
  ).toHaveValue("30");
  await expect(
    page.getByRole("combobox", { name: "Length", exact: true }),
  ).toHaveCount(0);
  await page.waitForTimeout(2000);
  expect(await stored(page, "acousticFeatures")).toEqual([]);
  await expect(page.locator("#artists option")).toHaveCount(4);
  await page.getByRole("button", { name: "Explore", exact: true }).click();
  await page
    .getByRole("button", { name: "Generate playlist", exact: true })
    .click();
  const result = page.locator(".generated-result");
  await expect(result).toBeVisible();
  await expect(result).toContainText("Library discovery");
  expect((await stored(page, "acousticFeatures")).length).toBe(3);
  await page.waitForTimeout(2000);
  expect((await stored(page, "acousticFeatures")).length).toBe(3);
  expect(await stored(page, "sessions")).toEqual([]);
  expect(await stored(page, "intervals")).toEqual([]);

  const ids = await result
    .locator(".track-row")
    .evaluateAll((rows) => rows.map((r) => r.getAttribute("data-track-id")));
  await result
    .locator(".track-row")
    .first()
    .getByRole("button", { name: /^Track actions:/ })
    .click();
  await page
    .getByRole("menuitem", { name: "Suggest less", exact: true })
    .click();
  await expect(page.locator(".toast")).toContainText("suggested less");
  expect((await stored(page, "suggestionLess")).length).toBe(1);
  expect(
    await result
      .locator(".track-row")
      .evaluateAll((rows) => rows.map((r) => r.getAttribute("data-track-id"))),
  ).toEqual(ids);
  await page
    .locator(".toast")
    .getByRole("button", { name: "Undo", exact: true })
    .click();
  await expect
    .poll(async () => (await stored(page, "suggestionLess")).length)
    .toBe(0);
  await result.getByRole("button", { name: "Save", exact: true }).click();
  const saved = (await stored(page, "playlists"))[0];
  expect(Object.keys(saved).sort()).toEqual([
    "id",
    "kind",
    "title",
    "trackIds",
  ]);
  expect(saved.trackIds).toEqual(ids);
  await page.reload();
  await page.getByRole("tab", { name: "Playlists", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Explore", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  expect(errors).toEqual([]);
});
test("feedback persistence failure rolls back, EN/ES narrow creator remains reachable", async ({
  page,
}) => {
  await library(page);
  await page.evaluate(() => {
    const original = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (...args) {
      if (this.name === "suggestionLess")
        throw new DOMException("Disk full", "QuotaExceededError");
      return original.apply(this, args);
    };
  });
  const row = page.locator(".track-row").first();
  await row.getByRole("button", { name: /^Track actions:/ }).click();
  await page
    .getByRole("menuitem", { name: "Suggest less", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("Disk full");
  await page
    .getByRole("alert")
    .getByRole("button", { name: "Close", exact: true })
    .click();
  await row.getByRole("button", { name: /^Track actions:/ }).click();
  await expect(
    page.getByRole("menuitem", { name: "Suggest less", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await openSettings(page);
  await page.getByRole("button", { name: "Español", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Cerrar", exact: true })
    .click();
  await page.setViewportSize({ width: 320, height: 640 });
  await page.getByRole("tab", { name: "Listas", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Equilibrada", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Explorar", exact: true }).click();
  await page
    .getByRole("button", { name: "Generar lista", exact: true })
    .scrollIntoViewIfNeeded();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "artifacts/personalized-creator-es-320.png",
    fullPage: true,
  });
});
