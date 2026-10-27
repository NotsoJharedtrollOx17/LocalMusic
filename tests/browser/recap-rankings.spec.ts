import { seedExistingSnapshot } from "./recapSnapshotFixture";
import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { openSettings } from "./navigationHelpers";

async function seed(page: Page) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setTimezoneOverride", { timezoneId: "UTC" });
  await page.clock.setFixedTime(new Date("2026-10-25T12:00:00Z"));
  await page.goto("/");
  await expect(
    page.getByRole("tab", { name: "Songs", exact: true }),
  ).toBeVisible();
  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve) => {
      const r = indexedDB.open("local-music-v1");
      r.onsuccess = () => resolve(r.result);
    });
    const wav = new ArrayBuffer(16044),
      view = new DataView(wav);
    const text = (offset: number, value: string) =>
      [...value].forEach((c, i) => view.setUint8(offset + i, c.charCodeAt(0)));
    text(0, "RIFF");
    view.setUint32(4, 16036, true);
    text(8, "WAVEfmt ");
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, 8000, true);
    view.setUint32(28, 16000, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    text(36, "data");
    view.setUint32(40, 16000, true);
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(
        ["tracks", "sessions", "intervals", "settings"],
        "readwrite",
      );
      tx.objectStore("settings").put(
        {
          language: "en",
          theme: "light",
          timeZone: "UTC",
          historyEnabledSince: "2026-01-01T00:00:00Z",
          privacyRevision: 0,
        },
        "preferences",
      );
      for (let i = 0; i < 12; i++) {
        const id = `rank-${String(i).padStart(2, "0")}`;
        tx.objectStore("tracks").put(
          {
            id,
            title: `Ranked song ${i + 1}`,
            artist:
              i < 10 ? "Leading artist with a very long name" : `Artist ${i}`,
            album: i < 8 ? "Leading album with a very long name" : `Album ${i}`,
            genre: "",
            durationMs: 60000,
            sourceUri: `/private/${id}`,
            available: i !== 0,
            hidden: i === 1,
            favorite: false,
            orderMetadataRead: true,
            releaseMetadataRead: true,
            audioChannels: 1,
            file: new Blob([wav], { type: "audio/wav" }),
            cover: new Blob(
              [
                `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160"><rect width="160" height="160" fill="hsl(${i * 29},65%,35%)"/><circle cx="80" cy="80" r="50" fill="#ff6816"/><text x="80" y="92" font-size="34" text-anchor="middle" fill="white">${i + 1}</text></svg>`,
              ],
              { type: "image/svg+xml" },
            ),
          },
          id,
        );
        for (let n = 0; n < 12 - i; n++) {
          const sessionId = `${id}-${n}`,
            startUtc = "2026-10-20T12:00:00Z";
          tx.objectStore("sessions").put(
            {
              id: sessionId,
              trackId: id,
              startedAtUtc: startUtc,
              playedMs: 30000,
              excluded: false,
            },
            sessionId,
          );
          tx.objectStore("intervals").put(
            { sessionId, sequence: 0, startUtc, playedMs: 30000 },
            sessionId,
          );
        }
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  });
  await page.reload();
  await page.getByRole("tab", { name: "Your Recap", exact: true }).click();
  await expect(
    page
      .getByRole("region", { name: "Top songs", exact: true })
      .getByRole("listitem"),
  ).toHaveCount(3);
}

test("top three scale by rank and top ten saves the exact playable order", async ({
  page,
}) => {
  await seed(page);
  const songs = page.getByRole("region", { name: "Top songs", exact: true });
  await expect(songs.getByRole("heading", { level: 3 })).toHaveText([
    "Ranked song 1",
    "Ranked song 2",
    "Ranked song 3",
  ]);
  for (const name of ["Top songs", "Top artists", "Top albums"]) {
    const group = page.getByRole("region", { name, exact: true });
    await expect(group.getByRole("listitem")).toHaveCount(3);
    const sizes = await group
      .locator("h3")
      .evaluateAll((nodes) =>
        nodes.map((n) => parseFloat(getComputedStyle(n).fontSize)),
      );
    expect(sizes[0]).toBeGreaterThan(sizes[1]);
    expect(sizes[1]).toBeGreaterThan(sizes[2]);
  }
  await expect(
    page.getByRole("button", { name: "Save snapshot", exact: true }),
  ).toHaveCount(0);
  const albums = page.getByRole("region", { name: "Top albums", exact: true });
  await expect(songs.locator(".recap-rank-artwork")).toHaveCount(3);
  await expect(albums.locator(".recap-rank-artwork")).toHaveCount(3);
  await expect(songs.locator(".recap-rank-artwork").first()).toHaveAttribute(
    "src",
    /^blob:/,
  );
  expect(
    await albums.locator(".recap-rank-artwork").first().getAttribute("src"),
  ).toBe(
    await songs.locator(".recap-rank-artwork").first().getAttribute("src"),
  );
  const list = page.getByRole("region", {
    name: "Your recap top 10",
    exact: true,
  });
  await expect(list.locator(".track-row")).toHaveCount(10);
  await expect(list.locator(".track-number")).toHaveText([
    "01",
    "02",
    "03",
    "04",
    "05",
    "06",
    "07",
    "08",
    "09",
    "10",
  ]);
  await expect(
    list.getByRole("button", { name: "Play Ranked song 1", exact: true }),
  ).toBeDisabled();
  await expect(
    list.getByRole("button", { name: "Play Ranked song 2", exact: true }),
  ).toBeDisabled();
  await list
    .getByRole("button", { name: "Save playlist", exact: true })
    .click();
  await expect(page.getByText("Playlist saved", { exact: true })).toBeVisible();
  const saved = await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve) => {
      const r = indexedDB.open("local-music-v1");
      r.onsuccess = () => resolve(r.result);
    });
    return await new Promise<any[]>((resolve) => {
      const r = db.transaction("playlists").objectStore("playlists").getAll();
      r.onsuccess = () => {
        resolve(r.result);
        db.close();
      };
    });
  });
  expect(saved).toHaveLength(1);
  expect(saved[0].trackIds).toEqual([
    "rank-02",
    "rank-03",
    "rank-04",
    "rank-05",
    "rank-06",
    "rank-07",
    "rank-08",
    "rank-09",
  ]);
  expect(saved[0].title).toBe("Your recap top 10 · 2026");
  await list.getByRole("button", { name: "Play top 10", exact: true }).click();
  await expect
    .poll(() =>
      page.evaluate(async () => {
        const db = await new Promise<IDBDatabase>((resolve) => {
          const r = indexedDB.open("local-music-v1");
          r.onsuccess = () => resolve(r.result);
        });
        return await new Promise<unknown>((resolve) => {
          const r = db
            .transaction("settings")
            .objectStore("settings")
            .get("queue");
          r.onsuccess = () => {
            resolve(r.result);
            db.close();
          };
        });
      }),
    )
    .toMatchObject({ queue: saved[0].trackIds });
  await page.getByRole("tab", { name: "Playlists", exact: true }).click();
  await expect(page.getByText(saved[0].title, { exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole("tab", { name: "Playlists", exact: true }).click();
  await expect(page.getByText(saved[0].title, { exact: true })).toBeVisible();
});

test("rankings and story reflow in EN/ES and retain accessible lists", async ({
  page,
}) => {
  await seed(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const width of [1280, 390, 320, 575]) {
    await page.setViewportSize({ width, height: width === 575 ? 373 : 800 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth - innerWidth,
      ),
    ).toBeLessThanOrEqual(1);
    await expect(
      page
        .getByRole("region", { name: "Top songs", exact: true })
        .getByRole("listitem"),
    ).toHaveCount(3);
  }
  await page.getByRole("button", { name: "View recap", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "3", exact: true }).click();
  await expect(dialog.getByRole("listitem")).toHaveCount(3);
  await expect(dialog.locator(".recap-rank-artwork")).toHaveCount(3);
  await page.screenshot({ path: "artifacts/recap-artwork-songs-story.png" });
  await dialog.getByRole("button", { name: "4", exact: true }).click();
  await expect(dialog.getByRole("listitem")).toHaveCount(3);
  await expect(
    dialog.getByRole("region", { name: "Top albums", exact: true }),
  ).toHaveCount(0);
  await dialog.getByRole("button", { name: "5", exact: true }).click();
  await expect(
    dialog.getByRole("region", { name: "Top artists", exact: true }),
  ).toHaveCount(0);
  await expect(dialog.locator(".recap-rank-artwork")).toHaveCount(3);
  await expect(dialog.locator(".recap-rank-artwork").first()).toBeVisible();
  expect(
    await dialog
      .locator(".recap-rank-artwork")
      .evaluateAll((images) =>
        images.every(
          (image) =>
            (image as HTMLImageElement).complete &&
            (image as HTMLImageElement).naturalWidth > 0,
        ),
      ),
  ).toBe(true);
  await expect(
    dialog.getByRole("button", { name: "7", exact: true }),
  ).toBeVisible();
  await page.screenshot({ path: "artifacts/recap-artwork-albums-story.png" });
  await page.keyboard.press("Escape");
  await page.setViewportSize({ width: 390, height: 800 });
  await openSettings(page);
  await page.getByRole("button", { name: "Español", exact: true }).click();
  await page.getByRole("button", { name: "Oscuro", exact: true }).click();
  await page.keyboard.press("Escape");
  await expect(
    page
      .getByRole("region", { name: "Canciones principales", exact: true })
      .getByRole("listitem"),
  ).toHaveCount(3);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.screenshot({
    path: "artifacts/recap-rankings-es-mobile.png",
    fullPage: true,
  });
});

test("exports include three ranks and old snapshots keep only recorded winners", async ({
  page,
}) => {
  await seed(page);
  await page.evaluate(() => {
    const state = window as any;
    state.cardCovers = [];
    const original = CanvasRenderingContext2D.prototype.drawImage;
    CanvasRenderingContext2D.prototype.drawImage = function (...args: any[]) {
      (original as any).apply(this, args);
      if (
        this.canvas.width === 2160 &&
        args.length === 9 &&
        args[0] instanceof HTMLImageElement
      ) {
        const probe = document.createElement("canvas");
        probe.width = probe.height = 1;
        const ctx = probe.getContext("2d")!;
        original.call(ctx, args[0], 0, 0);
        state.cardCovers.push({
          x: args[5],
          y: args[6],
          size: args[7],
          color: [...ctx.getImageData(0, 0, 1, 1).data],
        });
      }
    } as typeof original;
  });
  await page.getByRole("button", { name: "Export image", exact: true }).click();
  const dialog = page.getByRole("dialog");
  for (const format of ["Story", "Feed"]) {
    if (format === "Feed") {
      await page.evaluate(() => {
        (window as any).cardCovers = [];
      });
      await dialog.getByRole("button", { name: /^Feed/ }).click();
    }
    await expect(
      dialog.getByRole("button", { name: "Save PNG", exact: true }),
    ).toBeEnabled();
    const covers = await page.evaluate(
      () =>
        (window as any).cardCovers as {
          x: number;
          y: number;
          size: number;
          color: number[];
        }[],
    );
    expect(covers).toHaveLength(6);
    for (const group of [covers.slice(0, 3), covers.slice(3)]) {
      expect(group[0].size).toBeGreaterThan(group[1].size);
      expect(group[1].size).toBeGreaterThan(group[2].size);
    }
    const image = dialog.locator(".recap-image-preview");
    const pixels = await image.evaluate(async (node, covers) => {
      const img = node as HTMLImageElement;
      await img.decode();
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0);
      return covers.map(({ x, y }) => [
        ...ctx.getImageData(x * 2 + 16, y * 2 + 16, 1, 1).data,
      ]);
    }, covers);
    pixels.forEach((color, i) => expect(color).toEqual(covers[i].color));
    const wait = page.waitForEvent("download");
    await dialog.getByRole("button", { name: "Save PNG", exact: true }).click();
    await (
      await wait
    ).saveAs(`artifacts/recap-rankings-${format.toLowerCase()}.png`);
  }
  await page.keyboard.press("Escape");
  await seedExistingSnapshot(page);
  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve) => {
      const r = indexedDB.open("local-music-v1");
      r.onsuccess = () => resolve(r.result);
    });
    await new Promise<void>((resolve) => {
      const tx = db.transaction("snapshots", "readwrite"),
        store = tx.objectStore("snapshots"),
        r = store.openCursor();
      r.onsuccess = () => {
        const c = r.result;
        if (!c) return;
        const old = c.value;
        delete old.topArtists;
        delete old.topAlbums;
        c.update(old);
        c.continue();
      };
      tx.oncomplete = () => resolve();
    });
    db.close();
  });
  await page.reload();
  await page.getByRole("tab", { name: "Your Recap", exact: true }).click();
  await page
    .getByRole("button", { name: "Saved snapshots", exact: true })
    .click();
  await page.getByRole("dialog").locator(".snapshot-row").click();
  await expect(
    page
      .getByRole("region", { name: "Top songs", exact: true })
      .getByRole("listitem"),
  ).toHaveCount(3);
  await expect(
    page
      .getByRole("region", { name: "Top artists", exact: true })
      .getByRole("listitem"),
  ).toHaveCount(1);
  await expect(
    page
      .getByRole("region", { name: "Top albums", exact: true })
      .getByRole("listitem"),
  ).toHaveCount(1);
});

async function holdArtwork(page: Page) {
  await page.evaluate(() => {
    const state = window as any;
    state.heldCovers = [];
    const original = HTMLImageElement.prototype.decode;
    HTMLImageElement.prototype.decode = function () {
      return new Promise<void>((resolve, reject) => {
        state.heldCovers.push(() => original.call(this).then(resolve, reject));
      });
    };
    state.releaseCovers = () => {
      HTMLImageElement.prototype.decode = original;
      state.heldCovers.splice(0).forEach((release: () => void) => release());
    };
  });
}

test("delayed artwork cannot publish an old format or reopen a dismissed export", async ({
  page,
}) => {
  await seed(page);
  await holdArtwork(page);
  await page.getByRole("button", { name: "Export image", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect
    .poll(() => page.evaluate(() => (window as any).heldCovers.length))
    .toBeGreaterThan(0);
  await dialog.getByRole("button", { name: /^Feed/ }).click();
  await expect(
    dialog.getByRole("button", { name: "Save PNG", exact: true }),
  ).toBeDisabled();
  await expect(dialog.locator(".recap-image-preview")).toHaveCount(0);
  await expect
    .poll(() => page.evaluate(() => (window as any).heldCovers.length))
    .toBeGreaterThan(5);
  await page.evaluate(() => (window as any).releaseCovers());
  await expect(
    dialog.getByRole("button", { name: "Save PNG", exact: true }),
  ).toBeEnabled();
  expect(
    await dialog.locator(".recap-image-preview").evaluate(async (node) => {
      const img = node as HTMLImageElement;
      await img.decode();
      return img.naturalHeight;
    }),
  ).toBe(2700);
  await holdArtwork(page);
  await dialog.getByRole("button", { name: /^Story/ }).click();
  await expect
    .poll(() => page.evaluate(() => (window as any).heldCovers.length))
    .toBeGreaterThan(0);
  await page.keyboard.press("Escape");
  await page.evaluate(() => (window as any).releaseCovers());
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("privacy changes during artwork preparation prevent preview and saving", async ({
  page,
}) => {
  await seed(page);
  await holdArtwork(page);
  await page.getByRole("button", { name: "Export image", exact: true }).click();
  await expect
    .poll(() => page.evaluate(() => (window as any).heldCovers.length))
    .toBeGreaterThan(0);
  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve) => {
      const r = indexedDB.open("local-music-v1");
      r.onsuccess = () => resolve(r.result);
    });
    await new Promise<void>((resolve) => {
      const tx = db.transaction("settings", "readwrite"),
        store = tx.objectStore("settings"),
        r = store.get("preferences");
      r.onsuccess = () =>
        store.put({ ...r.result, privacyRevision: 1 }, "preferences");
      tx.oncomplete = () => resolve();
    });
    db.close();
    (window as any).releaseCovers();
  });
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("alert")).toContainText(
    "History privacy changed",
  );
  await expect(dialog.locator(".recap-image-preview")).toHaveCount(0);
  await expect(
    dialog.getByRole("button", { name: "Save PNG", exact: true }),
  ).toBeDisabled();
});

test("missing and corrupt covers fall back and a rendering failure can retry", async ({
  page,
}) => {
  await seed(page);
  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve) => {
      const r = indexedDB.open("local-music-v1");
      r.onsuccess = () => resolve(r.result);
    });
    await new Promise<void>((resolve) => {
      const tx = db.transaction("tracks", "readwrite"),
        store = tx.objectStore("tracks");
      for (const [id, cover] of [
        ["rank-00", new Blob(["invalid image"], { type: "image/png" })],
        ["rank-01", undefined],
      ] as const) {
        const r = store.get(id);
        r.onsuccess = () => store.put({ ...r.result, cover }, id);
      }
      tx.oncomplete = () => resolve();
    });
    db.close();
    const original = HTMLCanvasElement.prototype.getContext;
    let failed = false;
    HTMLCanvasElement.prototype.getContext = function (...args: any[]) {
      if (this.width === 2160 && !failed) {
        failed = true;
        return null;
      }
      return (original as any).apply(this, args);
    } as typeof original;
  });
  await page.getByRole("button", { name: "Export image", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("alert")).toContainText(
    "Image rendering unavailable",
  );
  await dialog.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(dialog.locator(".recap-image-preview")).toBeVisible();
  await expect(
    dialog.getByRole("button", { name: "Save PNG", exact: true }),
  ).toBeEnabled();
});
