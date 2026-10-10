import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
function wav(seconds = 40) {
  const rate = 16000,
    n = rate * seconds,
    b = Buffer.alloc(44 + n * 2);
  b.write("RIFF", 0);
  b.writeUInt32LE(36 + n * 2, 4);
  b.write("WAVEfmt ", 8);
  b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20);
  b.writeUInt16LE(1, 22);
  b.writeUInt32LE(rate, 24);
  b.writeUInt32LE(rate * 2, 28);
  b.writeUInt16LE(2, 32);
  b.writeUInt16LE(16, 34);
  b.write("data", 36);
  b.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++)
    b.writeInt16LE(Math.sin((i / rate) * 220 * Math.PI * 2) * 2000, 44 + i * 2);
  return b;
}
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
  await page
    .locator(".sidebar nav")
    .getByRole("button", { name: "Your Year" })
    .click();
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
  await page
    .locator(".bottom-nav")
    .getByRole("button", { name: "Playlists" })
    .click();
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
  await page
    .locator(".bottom-nav")
    .getByRole("button", { name: "Your Year" })
    .click();
  await expect(page.getByText("0 qualified plays")).toBeVisible();
  await page
    .locator(".mobile-brand")
    .getByRole("button", { name: "Settings" })
    .click();
  await page.getByLabel("Language", { exact: true }).selectOption("es");
  await expect(page.getByRole("dialog", { name: "Ajustes" })).toBeVisible();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Cerrar" })
    .click();
  await expect(
    page.locator(".bottom-nav").getByRole("button", { name: "Tu año" }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.locator(".bottom-nav").getByRole("button", { name: "Biblioteca" }),
  ).toBeVisible();
  await expect(page.getByText("8 canciones", { exact: true })).toBeVisible();
});

test("30 seconds qualify a play and excluding a session removes its evidence", async ({
  page,
}) => {
  await page.goto("/");
  await page.locator("input[type=file]").first().setInputFiles({
    name: "Qualified tone.wav",
    mimeType: "audio/wav",
    buffer: wav(),
  });
  await expect(
    page.locator(".toast").filter({ hasText: "1 tracks imported" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Play Qualified tone", exact: true })
    .click();
  await page.waitForTimeout(31500);
  await page
    .locator(".mini-center")
    .getByRole("button", { name: "Pause", exact: true })
    .click();
  await page
    .locator(".sidebar nav")
    .getByRole("button", { name: "Your Year" })
    .click();
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
    .locator(".sidebar nav")
    .getByRole("button", { name: "Library" })
    .click();
  await page
    .locator(".sidebar nav")
    .getByRole("button", { name: "Your Year" })
    .click();
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
  await page
    .locator(".sidebar nav")
    .getByRole("button", { name: "Your Year" })
    .click();
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
    .locator(".track-row")
    .getByRole("button", { name: "Favorite", exact: true })
    .click();
  await page.getByRole("searchbox").fill("");
  await page.getByRole("button", { name: "Favorites", exact: true }).click();
  await expect(page.getByText("1 songs", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Play Fixture 120", exact: true }),
  ).toBeVisible();
  await page
    .locator(".sidebar nav")
    .getByRole("button", { name: "Playlists", exact: true })
    .click();
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

function taggedWav(title: string, marker: number, seconds = 1) {
  const base = wav(seconds);
  base.writeInt16LE(marker, 44);
  const chunk = (kind: string, value: string) => {
    const bytes = Buffer.from(value + "\0");
    const part = Buffer.alloc(8 + bytes.length + (bytes.length % 2));
    part.write(kind, 0);
    part.writeUInt32LE(bytes.length, 4);
    bytes.copy(part, 8);
    return part;
  };
  const info = Buffer.concat([
    Buffer.from("INFO"),
    chunk("IART", "Fixture Artist"),
    chunk("IPRD", "Fixture Album"),
    chunk("INAM", title),
  ]);
  const header = Buffer.alloc(8);
  header.write("LIST", 0);
  header.writeUInt32LE(info.length, 4);
  const result = Buffer.concat([base, header, info]);
  result.writeUInt32LE(result.length - 8, 4);
  return result;
}

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

function numberedWav(
  title: string,
  trackNumber: number,
  discNumber: number,
  marker: number,
) {
  const base = taggedWav(title, marker, 40);
  const frames = Buffer.concat(
    [
      ["TIT2", title],
      ["TPE1", "Fixture Artist"],
      ["TALB", "Fixture Album"],
      ["TRCK", String(trackNumber) + "/12"],
      ["TPOS", String(discNumber) + "/2"],
      ["TYER", "2001"],
    ].map(([name, value]) => {
      const body = Buffer.concat([Buffer.from([0]), Buffer.from(value)]);
      const header = Buffer.alloc(10);
      header.write(name);
      header.writeUInt32BE(body.length, 4);
      return Buffer.concat([header, body]);
    }),
  );
  const id3 = Buffer.alloc(10);
  id3.write("ID3");
  id3[3] = 3;
  for (let i = 0; i < 4; i++)
    id3[6 + i] = (frames.length >>> (7 * (3 - i))) & 127;
  const content = Buffer.concat([id3, frames]);
  const chunk = Buffer.alloc(8);
  chunk.write("id3 ");
  chunk.writeUInt32LE(content.length, 4);
  const result = Buffer.concat([
    base,
    chunk,
    content,
    Buffer.alloc(content.length % 2),
  ]);
  result.writeUInt32LE(result.length - 8, 4);
  return result;
}

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
    .locator(".full-player")
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
