import { test, expect, type Page } from "@playwright/test";
import { holdNextTrackRead, release } from "./catalog-gate";
import { openSettings } from "./navigationHelpers";

async function seed(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Explore with sample audio" }).click();
  await expect(page.locator(".track-row")).toHaveCount(8);
  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve) => {
      const r = indexedDB.open("local-music-v1");
      r.onsuccess = () => resolve(r.result);
    });
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(["tracks", "playlists"], "readwrite");
      const read = tx.objectStore("tracks").getAllKeys();
      read.onsuccess = () => {
        tx.objectStore("playlists").put(
          {
            id: "slow",
            title: "Slow mix",
            kind: "manual",
            trackIds: read.result.slice(0, 2),
          },
          "slow",
        );
        tx.objectStore("playlists").put(
          {
            id: "fast",
            title: "Fast mix",
            kind: "manual",
            trackIds: read.result.slice(2, 4),
          },
          "fast",
        );
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  });
  await page.reload();
  await page.getByRole("tab", { name: "Playlists", exact: true }).click();
  await expect(page.locator(".saved-playlist-card .playlist-tile")).toHaveCount(
    2,
  );
}
const tile = (page: Page, title: string) =>
  page.locator(".playlist-tile").filter({ hasText: title });
async function failPlaylistWrite(page: Page) {
  await page.evaluate(() => {
    const original = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (...args: any[]) {
      if (this.name === "playlists") {
        IDBObjectStore.prototype.put = original;
        throw new DOMException(
          "Forced playlist write failure",
          "QuotaExceededError",
        );
      }
      return Reflect.apply(original, this, args);
    };
  });
}
async function holdPlaylistWrite(page: Page) {
  await page.evaluate(() => {
    const original = IDBDatabase.prototype.transaction;
    let resume!: () => void;
    const gate = new Promise<void>((resolve) => {
      resume = resolve;
    });
    (window as any).releasePlaylistWrite = resume;
    (window as any).playlistWriteHeld = false;
    IDBDatabase.prototype.transaction = function (...args: any[]) {
      const tx = Reflect.apply(original, this, args) as IDBTransaction;
      if (
        args[1] === "readwrite" &&
        tx.objectStoreNames.contains("playlists")
      ) {
        IDBDatabase.prototype.transaction = original;
        tx.addEventListener(
          "complete",
          (event) => {
            event.stopImmediatePropagation();
            (window as any).playlistWriteHeld = true;
            void gate.then(() => tx.oncomplete?.call(tx, event));
          },
          { once: true },
        );
      }
      return tx;
    };
  });
}
async function releaseWrite(page: Page) {
  await page.evaluate(() => (window as any).releasePlaylistWrite());
}
async function manual(page: Page) {
  await page.getByRole("button", { name: "New playlist", exact: true }).click();
  const d = page.getByRole("dialog", { name: "New playlist", exact: true });
  await d.getByLabel("Playlist name", { exact: true }).fill("Stress draft");
  await d.getByRole("checkbox").first().check();
  return d;
}

test("a late playlist open cannot replace a newer playlist choice", async ({
  page,
}) => {
  await seed(page);
  await holdNextTrackRead(page, "track");
  await tile(page, "Slow mix").click();
  await expect
    .poll(() => page.evaluate(() => (window as any).catalogReadHeld))
    .toBe(true);
  await tile(page, "Fast mix").click();
  await expect(page.locator(".playlist-toolbar h2")).toHaveText("Fast mix");
  await release(page);
  await page.waitForTimeout(200);
  await expect(page.locator(".playlist-toolbar h2")).toHaveText("Fast mix");
});

test("leaving Playlists cancels a delayed open instead of opening it on return", async ({
  page,
}) => {
  await seed(page);
  await holdNextTrackRead(page, "track");
  await tile(page, "Slow mix").click();
  await expect
    .poll(() => page.evaluate(() => (window as any).catalogReadHeld))
    .toBe(true);
  await page.getByRole("tab", { name: "Songs", exact: true }).click();
  await release(page);
  await page.waitForTimeout(200);
  await page.getByRole("tab", { name: "Playlists", exact: true }).click();
  await expect(tile(page, "Fast mix")).toBeVisible();
  await expect(page.locator(".playlist-detail-head")).toHaveCount(0);
});

test("failed manual saving preserves the draft and supports retry", async ({
  page,
}) => {
  await seed(page);
  const d = await manual(page);
  await failPlaylistWrite(page);
  await d.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText(
    "Forced playlist write failure",
  );
  await expect(d).toBeVisible();
  await expect(d.getByLabel("Playlist name", { exact: true })).toHaveValue(
    "Stress draft",
  );
  await expect(d.getByRole("checkbox").first()).toBeChecked();
  await d.getByRole("button", { name: "Save", exact: true }).click();
  await expect(d).toHaveCount(0);
  await expect(tile(page, "Stress draft")).toHaveCount(1);
});

test("manual Save blocks repeated submissions until persistence completes", async ({
  page,
}) => {
  await seed(page);
  const d = await manual(page);
  await holdPlaylistWrite(page);
  await d.getByRole("button", { name: "Save", exact: true }).click();
  await expect
    .poll(() => page.evaluate(() => (window as any).playlistWriteHeld))
    .toBe(true);
  await expect(
    d.getByRole("button", { name: "Save", exact: true }),
  ).toBeDisabled();
  await d
    .locator("form")
    .evaluate((form) =>
      form.dispatchEvent(
        new Event("submit", { bubbles: true, cancelable: true }),
      ),
    );
  await releaseWrite(page);
  await expect(d).toHaveCount(0);
  await expect(tile(page, "Stress draft")).toHaveCount(1);
});

test("failed playlist editing keeps edit controls and unsaved order available", async ({
  page,
}) => {
  await seed(page);
  await tile(page, "Slow mix").click();
  await page
    .getByRole("button", { name: "Edit playlist", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Move down", exact: true })
    .first()
    .click();
  const titles = await page.locator(".track-copy strong").allTextContents();
  await failPlaylistWrite(page);
  await page
    .getByRole("button", { name: "Save playlist", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText(
    "Forced playlist write failure",
  );
  await expect(
    page.getByRole("button", { name: "Save playlist", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".track-copy strong")).toHaveText(titles);
  await page
    .getByRole("button", { name: "Save playlist", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Edit playlist", exact: true }),
  ).toBeVisible();
});

test("a dismissed add-to-playlist write cannot close a newly opened Settings dialog", async ({
  page,
}) => {
  await seed(page);
  await page.getByRole("tab", { name: "Songs", exact: true }).click();
  await page
    .locator(".track-row")
    .first()
    .getByRole("button", { name: /^Track actions:/ })
    .click();
  await page
    .getByRole("menuitem", { name: "Add to playlist", exact: true })
    .click();
  const add = page.getByRole("dialog", {
    name: "Add selected songs to playlist",
    exact: true,
  });
  await holdPlaylistWrite(page);
  await add.getByRole("button", { name: "Slow mix", exact: true }).click();
  await expect
    .poll(() => page.evaluate(() => (window as any).playlistWriteHeld))
    .toBe(true);
  await page.keyboard.press("Escape");
  const settings = await openSettings(page);
  await releaseWrite(page);
  await page.waitForTimeout(200);
  await expect(settings).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(1);
});

test("album review selectors expose concise accessible names", async ({
  page,
}) => {
  await seed(page);
  const settings = await openSettings(page);
  await settings
    .getByRole("button", { name: "Organize library", exact: true })
    .click();
  const d = page.getByRole("dialog", { name: "Organize library", exact: true });
  await d.getByRole("button", { name: "Albums", exact: true }).click();
  await d.locator(".organization-choice").first().getByRole("checkbox").check();
  await expect(d.locator("select")).toHaveAccessibleName("Artwork");
});

test("playlist rows cannot change while their order is being saved", async ({
  page,
}) => {
  await seed(page);
  await tile(page, "Slow mix").click();
  await page
    .getByRole("button", { name: "Edit playlist", exact: true })
    .click();
  await holdPlaylistWrite(page);
  await page
    .getByRole("button", { name: "Save playlist", exact: true })
    .click();
  await expect
    .poll(() => page.evaluate(() => (window as any).playlistWriteHeld))
    .toBe(true);
  for (const button of await page
    .locator(".track-row")
    .getByRole("button", { name: /^(Move up|Move down|Remove)$/ })
    .all())
    await expect(button).toBeDisabled();
  await releaseWrite(page);
  await expect(
    page.getByRole("button", { name: "Edit playlist", exact: true }),
  ).toBeVisible();
});

test("manual saving after dismissal leaves a newer dialog open", async ({
  page,
}) => {
  await seed(page);
  const d = await manual(page);
  await holdPlaylistWrite(page);
  await d.getByRole("button", { name: "Save", exact: true }).click();
  await expect
    .poll(() => page.evaluate(() => (window as any).playlistWriteHeld))
    .toBe(true);
  await page.keyboard.press("Escape");
  const settings = await openSettings(page);
  await releaseWrite(page);
  await page.waitForTimeout(200);
  await expect(settings).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(1);
});

test("a canceled playlist open also clears its loading indicator", async ({
  page,
}) => {
  await seed(page);
  await holdNextTrackRead(page, "track");
  await tile(page, "Slow mix").click();
  await expect
    .poll(() => page.evaluate(() => (window as any).catalogReadHeld))
    .toBe(true);
  await page.getByRole("button", { name: "New playlist", exact: true }).click();
  await release(page);
  await page.keyboard.press("Escape");
  await expect(tile(page, "Slow mix")).toHaveAttribute("aria-busy", "false");
  await expect(page.locator(".playlist-detail-head")).toHaveCount(0);
});
