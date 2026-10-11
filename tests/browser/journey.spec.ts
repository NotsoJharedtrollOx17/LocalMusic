import { wav, taggedWav, numberedWav } from "./fixtures";
import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";

test("import, actual listening, seek, recap and privacy-safe exports", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Make room for your music." }),
  ).toBeVisible();
  await page.locator("input[type=file]").first().setInputFiles({
    name: "Original test tone.wav",
    mimeType: "audio/wav",
    buffer: wav(),
  });
  await expect(
    page.locator(".toast").filter({ hasText: "1 tracks imported" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Play Original test tone", exact: true })
    .click();
  await expect(page.locator(".mini-player")).toBeVisible();
  await page
    .locator(".mini-actions")
    .getByRole("button", { name: "Now playing" })
    .click();
  const dialog = page.getByRole("dialog", { name: "Now playing" });
  await expect(
    dialog.getByRole("button", { name: "Pause", exact: true }),
  ).toBeVisible();
  await page.waitForTimeout(1400);
  await dialog.getByRole("slider").fill("25000");
  await page.waitForTimeout(1400);
  await dialog.getByRole("button", { name: "Pause", exact: true }).click();
  await dialog.getByRole("button", { name: "Close", exact: true }).click();
  await page.getByRole("tab", { name: "Your Year" }).click();
  await expect(page.getByText("0 qualified plays")).toBeVisible();
  await expect(page.getByRole("button", { name: /Export JSON/i })).toHaveCount(
    0,
  );
  await page.getByRole("button", { name: "Export image", exact: true }).click();
  const share = page.getByRole("dialog", { name: "Export image" });
  await expect(share.locator(".recap-image-preview")).toBeVisible();
  await expect(
    share.getByRole("button", { name: "Save PNG", exact: true }),
  ).toBeEnabled();
  const pngWait = page.waitForEvent("download");
  await share.getByRole("button", { name: "Save PNG", exact: true }).click();
  const png = await pngWait;
  const image = await readFile((await png.path())!);
  expect(image.readUInt32BE(16)).toBe(2160);
  expect(image.readUInt32BE(20)).toBe(3840);
  await png.saveAs("artifacts/recap-story.png");
  await expect(share.getByRole("status")).toContainText("Image saved");
  const confirmation = share.locator(".recap-save-toast");
  await expect(confirmation).toBeInViewport();
  await share.locator(".modal-head").scrollIntoViewIfNeeded();
  await expect(confirmation).toBeInViewport();
  await share.getByRole("button", { name: "Feed · 4:5" }).click();
  await expect(
    share.getByRole("button", { name: "Save PNG", exact: true }),
  ).toBeEnabled();
  const feedWait = page.waitForEvent("download");
  await share.getByRole("button", { name: "Save PNG", exact: true }).click();
  const feed = await feedWait;
  const feedImage = await readFile((await feed.path())!);
  expect(feedImage.readUInt32BE(16)).toBe(2160);
  expect(feedImage.readUInt32BE(20)).toBe(2700);
  await feed.saveAs("artifacts/recap-feed.png");
  await page.screenshot({ path: "artifacts/recap-export-preview.png" });
  await share.getByRole("button", { name: "Close", exact: true }).click();
  await page
    .getByRole("button", { name: "Save snapshot", exact: true })
    .click();
  await expect(page.getByText("Snapshot saved", { exact: true })).toBeVisible();
  await page.screenshot({
    path: "artifacts/recap-desktop.png",
    fullPage: true,
  });
  expect(errors).toEqual([]);
});
test("mobile sample library, filter playlist, editing and Spanish UI", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "Explore with sample audio" }).click();
  await expect(page.getByText("8 songs", { exact: true })).toBeVisible();
  await page.screenshot({
    path: "artifacts/library-mobile.png",
    fullPage: true,
  });
  await page.getByRole("tab", { name: "Playlists", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Library", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("tab", { name: "Playlists", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await expect(page.locator(".bottom-nav")).toHaveCount(0);
  await page.screenshot({
    path: "artifacts/playlists-tab-mobile.png",
    fullPage: true,
  });
  await page.getByLabel("Playlist name", { exact: true }).fill("Night mix");
  await page.getByLabel("Exclude artist", { exact: true }).fill("Field Notes");
  await page
    .getByRole("button", { name: "Generate playlist", exact: true })
    .click();
  await expect(page.locator(".generated-result")).toBeVisible();
  await expect(
    page.locator(".generated-result").getByText("Field Notes", { exact: true }),
  ).toHaveCount(0);
  await page
    .locator(".generated-result")
    .getByRole("button", { name: "Save", exact: true })
    .click();
  await expect(page.getByText("Playlist saved", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Play this mix", exact: true })
    .click();
  await expect(page.locator(".mini-player")).toBeVisible();
  await page.locator(".mini-track").click();
  await expect(
    page.getByText("Sample audio · excluded from recap"),
  ).toBeVisible();
  await page.screenshot({ path: "artifacts/player-mobile.png" });
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Pause", exact: true })
    .click();
  await page.getByRole("dialog").getByRole("button", { name: "Close" }).click();
  await page.getByRole("tab", { name: "Your Year" }).click();
  await expect(page.getByText("0 qualified plays")).toBeVisible();
  await page
    .locator(".heading-actions")
    .getByRole("button", { name: "Settings" })
    .click();
  await page.getByRole("button", { name: "Espa\u00f1ol", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Ajustes" })).toBeVisible();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Cerrar" })
    .click();
  await expect(page.getByRole("tab", { name: "Tu año" })).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Biblioteca", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("8 canciones", { exact: true })).toBeVisible();
});

test("30 seconds qualify a play and excluding a session removes its evidence", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .locator("input[type=file]")
    .first()
    .setInputFiles({
      name: "Qualified tone.wav",
      mimeType: "audio/wav",
      buffer: wav(70),
    });
  await expect(
    page.locator(".toast").filter({ hasText: "1 tracks imported" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Play Qualified tone", exact: true })
    .click();
  // Wait for recorded listening evidence, not wall time since the click.
  await expect
    .poll(
      () =>
        page.evaluate(
          () =>
            new Promise<number>((resolve, reject) => {
              const request = indexedDB.open("local-music-v1", 1);
              request.onerror = () => reject(request.error);
              request.onsuccess = () => {
                const db = request.result;
                const read = db
                  .transaction("sessions")
                  .objectStore("sessions")
                  .getAll();
                read.onsuccess = () => {
                  resolve(
                    Math.max(
                      0,
                      ...read.result.map(
                        (session: { playedMs: number }) => session.playedMs,
                      ),
                    ),
                  );
                  db.close();
                };
                read.onerror = () => {
                  db.close();
                  reject(read.error);
                };
              };
            }),
        ),
      { timeout: 50000, intervals: [500] },
    )
    .toBeGreaterThanOrEqual(30000);
  await page
    .locator(".mini-center")
    .getByRole("button", { name: "Pause", exact: true })
    .click();
  await page.getByRole("tab", { name: "Your Year" }).click();
  await expect(page.getByText("1 qualified plays")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Qualified tone", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Save snapshot", exact: true })
    .click();
  await expect(page.getByText("Snapshot saved", { exact: true })).toBeVisible();
  await page
    .locator(".mini-actions")
    .getByRole("button", { name: "Now playing" })
    .click();
  await page.getByLabel("Exclude from recap", { exact: true }).check();
  await page.getByRole("dialog").getByRole("button", { name: "Close" }).click();
  await page
    .locator(".library-brand-header")
    .getByRole("link", { name: "Library" })
    .click();
  await page.getByRole("tab", { name: "Your Year" }).click();
  await expect(page.getByText("0 qualified plays")).toBeVisible();
  await page
    .getByRole("button", { name: "Saved snapshots", exact: true })
    .click();
  await page.getByRole("dialog").locator(".snapshot-row").first().click();
  await expect(page.getByText("1 qualified plays")).toBeVisible();
  await page.getByRole("button", { name: "Export image", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText(
    "History privacy changed",
  );
  await page.reload();
  await page.getByRole("tab", { name: "Your Year" }).click();
  await expect(page.getByText("0 qualified plays")).toBeVisible();
});

test("catalog pagination, favorites and manual picker cover unloaded songs", async ({
  page,
}) => {
  await page.goto("/");
  const files = Array.from({ length: 125 }, (_, i) => {
    const buffer = wav(1);
    buffer.writeInt16LE(i, 44);
    return {
      name: "Fixture " + String(i).padStart(3, "0") + ".wav",
      mimeType: "audio/wav",
      buffer,
    };
  });
  await page.locator("input[type=file]").first().setInputFiles(files);
  await expect(page.getByText("125 songs", { exact: true })).toBeVisible({
    timeout: 20000,
  });
  expect(await page.locator(".track-row").count()).toBeLessThan(40);
  await page.getByRole("button", { name: "Search your library" }).click();
  await page.getByRole("searchbox").fill("Fixture 120");
  await expect(
    page.getByRole("button", { name: "Play Fixture 120", exact: true }),
  ).toBeVisible();
  await page
    .locator(".search-surface .track-row")
    .getByRole("button", { name: "Favorite", exact: true })
    .click();
  await page
    .locator(".search-surface")
    .getByRole("button", { name: "Close", exact: true })
    .last()
    .click();
  await page
    .getByRole("button", { name: "Library actions", exact: true })
    .click();
  await page.getByRole("menuitem", { name: "Favorites", exact: true }).click();
  await expect(page.getByText("1 song", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Play Fixture 120", exact: true }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "Playlists", exact: true }).click();
  await page.getByRole("button", { name: "New playlist", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByLabel("Playlist name", { exact: true })
    .fill("Manual selection");
  await dialog
    .getByRole("textbox", { name: "Search your library" })
    .fill("Fixture 124");
  await expect(dialog.getByRole("checkbox")).toHaveCount(1);
  await dialog.getByRole("checkbox").check();
  await dialog.getByRole("button", { name: "Save", exact: true }).click();
  await expect(
    page.getByText("Manual selection", { exact: true }),
  ).toBeVisible();
});

test("import publishes ten tracks before the remaining files finish", async ({
  page,
}) => {
  await page.goto("/");
  await page.evaluate(() => {
    const original = crypto.subtle.digest.bind(crypto.subtle);
    let calls = 0;
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    (window as unknown as { releaseImport: () => void }).releaseImport =
      release;
    crypto.subtle.digest = async (algorithm, data) => {
      if (++calls === 11) await gate;
      return original(algorithm, data);
    };
  });
  const files = Array.from({ length: 11 }, (_, i) => {
    const buffer = wav(1);
    buffer.writeInt16LE(i, 44);
    return { name: "Batch " + i + ".wav", mimeType: "audio/wav", buffer };
  });
  await page.locator("input[type=file]").first().setInputFiles(files);
  await expect(page.locator(".import-status")).toBeVisible();
  await expect(page.locator(".import-spinner")).toBeVisible();
  await expect(page.getByText("10 songs", { exact: true })).toBeVisible();
  await expect(page.locator(".import-status")).toContainText(
    "10 tracks imported",
  );
  const cover = page.locator(".track-row .cover").first();
  await expect(cover).toHaveAttribute("src", /^data:image\/svg/);
  expect(
    await cover.evaluate((image) => (image as HTMLImageElement).naturalWidth),
  ).toBeGreaterThan(0);
  await page.evaluate(() =>
    (window as unknown as { releaseImport: () => void }).releaseImport(),
  );
  await expect(page.getByText("11 songs", { exact: true })).toBeVisible();
  await expect(page.locator(".import-status")).toHaveCount(0);
  await page.reload();
  await expect(page.getByText("11 songs", { exact: true })).toBeVisible();
});

test("artist and album details stay populated as import batches arrive", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .locator("input[type=file]")
    .first()
    .setInputFiles({
      name: "Initial.wav",
      mimeType: "audio/wav",
      buffer: taggedWav("Initial", 1),
    });
  await expect(page.locator(".toast")).toContainText("1 tracks imported");
  await page.getByRole("tab", { name: "Artists" }).click();
  await page
    .locator(".album-card")
    .filter({ hasText: "Fixture Artist" })
    .click();
  await expect(
    page.getByRole("button", { name: "Play Initial", exact: true }),
  ).toBeVisible();
  await page.evaluate(() => {
    const original = crypto.subtle.digest.bind(crypto.subtle);
    let calls = 0;
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    (
      window as unknown as { releaseGroupImport: () => void }
    ).releaseGroupImport = release;
    crypto.subtle.digest = async (algorithm, data) => {
      if (++calls === 11) await gate;
      return original(algorithm, data);
    };
  });
  const files = Array.from({ length: 11 }, (_, i) => ({
    name: "Song " + i + ".wav",
    mimeType: "audio/wav",
    buffer: taggedWav("Song " + i, i + 2),
  }));
  await page.locator("input[type=file]").first().setInputFiles(files);
  await expect(page.locator(".import-status")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Fixture Artist" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Play Song 9", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("11 songs", { exact: true })).toBeVisible();
  await page.evaluate(() =>
    (
      window as unknown as { releaseGroupImport: () => void }
    ).releaseGroupImport(),
  );
  await expect(
    page.getByRole("button", { name: "Play Song 10", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("12 songs", { exact: true })).toBeVisible();
  await page.locator(".group-back").click();
  await page.getByRole("tab", { name: "Albums" }).click();
  await expect(
    page.locator(".album-card").filter({ hasText: "Fixture Album" }),
  ).toBeVisible();
  await page.evaluate(() => {
    const original = IDBObjectStore.prototype.getAll;
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    (window as unknown as { releaseAlbumRead: () => void }).releaseAlbumRead =
      release;
    IDBObjectStore.prototype.getAll = function (...args) {
      const request = original.apply(this, args);
      if (this.name === "tracks") {
        IDBObjectStore.prototype.getAll = original;
        request.addEventListener(
          "success",
          (event) => {
            event.stopImmediatePropagation();
            void gate.then(() => request.onsuccess?.call(request, event));
          },
          { once: true },
        );
      }
      return request;
    };
  });
  await page
    .locator(".album-card")
    .filter({ hasText: "Fixture Album" })
    .click();
  await expect(page.locator(".group-loading")).toBeVisible();
  await expect(
    page.locator(".album-card").filter({ hasText: "Fixture Album" }),
  ).toBeVisible();
  await expect(page.locator(".group-back")).toHaveCount(0);
  await page.getByRole("tab", { name: "Songs", exact: true }).click();
  await page.evaluate(() =>
    (window as unknown as { releaseAlbumRead: () => void }).releaseAlbumRead(),
  );
  await expect(
    page.getByRole("tab", { name: "Songs", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await expect(page.locator(".group-back")).toHaveCount(0);
  await page.getByRole("tab", { name: "Albums" }).click();
  await page
    .locator(".album-card")
    .filter({ hasText: "Fixture Album" })
    .click();
  await expect(
    page.getByRole("button", { name: "Play Song 10", exact: true }),
  ).toBeVisible();
  await page
    .locator("input[type=file]")
    .first()
    .setInputFiles({
      name: "Final.wav",
      mimeType: "audio/wav",
      buffer: taggedWav("Final", 30),
    });
  await expect(
    page.getByRole("button", { name: "Play Final", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("13 songs", { exact: true })).toBeVisible();
});

test("album disc order is preserved in views, queue and legacy library migration", async ({
  page,
}) => {
  await page.goto("/");
  const expected = [
    "Zulu opener",
    "Middle song",
    "Alpha finale",
    "Disc two opener",
  ];
  const files = [
    { title: "Alpha finale", track: 10, disc: 1 },
    { title: "Disc two opener", track: 1, disc: 2 },
    { title: "Middle song", track: 2, disc: 1 },
    { title: "Zulu opener", track: 1, disc: 1 },
  ];
  await page
    .locator("input[type=file]")
    .first()
    .setInputFiles(
      files.map((f, i) => ({
        name: f.title + ".wav",
        mimeType: "audio/wav",
        buffer: numberedWav(f.title, f.track, f.disc, i + 100),
      })),
    );
  await expect(page.locator(".toast")).toContainText("4 tracks imported");
  await page.locator(".sort-select select").selectOption("album");
  await expect(page.locator(".library-page .track-copy strong")).toHaveText(
    expected,
  );
  await page.getByRole("tab", { name: "Albums" }).click();
  await expect(
    page
      .locator(".album-card")
      .filter({ hasText: "Fixture Album" })
      .locator("span"),
  ).toHaveText("Fixture Artist · 2001");
  await page
    .locator(".album-card")
    .filter({ hasText: "Fixture Album" })
    .click();
  await expect(page.locator(".library-page .track-copy strong")).toHaveText(
    expected,
  );
  await page
    .getByRole("button", { name: "Play Zulu opener", exact: true })
    .click();
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await page.locator(".mini-track").click();
  await page
    .locator(".player-surface-head")
    .getByRole("button", { name: "Queue", exact: true })
    .click();
  await expect(
    page.getByRole("dialog").locator(".track-copy strong"),
  ).toHaveText(expected);
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page.locator(".group-back").click();
  await page.getByRole("tab", { name: "Artists" }).click();
  await page
    .locator(".album-card")
    .filter({ hasText: "Fixture Artist" })
    .click();
  await expect(page.locator(".library-page .track-copy strong")).toHaveText(
    expected,
  );
  await expect(page.locator(".library-page .album-label")).toHaveText(
    Array(4).fill("Fixture Album · 2001"),
  );
  await page.screenshot({ path: "artifacts/album-year-label.png" });
  // Simulate the previous catalog format; retained audio blobs must restore the tags.
  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("local-music-v1", 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("tracks", "readwrite");
      const request = tx.objectStore("tracks").openCursor();
      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor) return;
        const value = cursor.value;
        delete value.trackNumber;
        delete value.discNumber;
        delete value.orderMetadataRead;
        delete value.releaseYear;
        delete value.releaseMetadataRead;
        value.favorite = true;
        cursor.update(value);
        cursor.continue();
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  });
  await page.reload();
  await page.getByRole("tab", { name: "Albums" }).click();
  await page
    .locator(".album-card")
    .filter({ hasText: "Fixture Album" })
    .click();
  await expect(page.locator(".library-page .track-copy strong")).toHaveText(
    expected,
  );
  await expect(page.locator(".library-page .album-label")).toHaveText(
    Array(4).fill("Fixture Album · 2001"),
  );
  await expect(
    page.locator(".library-page .track-row .icon-button[aria-pressed=true]"),
  ).toHaveCount(4);
});
