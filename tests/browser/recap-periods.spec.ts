import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { readFile } from "node:fs/promises";
import { holdNextTrackRead, release } from "./catalog-gate";
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
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const r = indexedDB.open("local-music-v1", 1);
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(
        ["settings", "tracks", "sessions", "intervals", "snapshots"],
        "readwrite",
      );
      tx.objectStore("settings").put(
        {
          language: "en",
          theme: "light",
          timeZone: "UTC",
          historyEnabledSince: "2025-01-01T00:00:00Z",
          privacyRevision: 0,
        },
        "preferences",
      );
      const track = {
        id: "period-song",
        title: "Calendar Song",
        artist: "Calendar Artist",
        album: "Calendar Album",
        genre: "Rock",
        durationMs: 60000,
        sourceUri: "/private/period-song",
        file: new Blob(),
        available: true,
        favorite: false,
        orderMetadataRead: true,
        releaseMetadataRead: true,
      };
      tx.objectStore("tracks").put(track, track.id);
      for (const [index, [startUtc, minutes]] of (
        [
          ["2026-10-19T12:00:00Z", 1],
          ["2026-10-12T12:00:00Z", 2],
          ["2026-09-01T12:00:00Z", 3],
        ] as const
      ).entries()) {
        const id = `period-session-${index}`,
          playedMs = minutes * 60000;
        tx.objectStore("sessions").put(
          {
            id,
            trackId: track.id,
            startedAtUtc: startUtc,
            playedMs,
            excluded: false,
          },
          id,
        );
        tx.objectStore("intervals").put(
          { sessionId: id, sequence: 0, startUtc, playedMs },
          `${id}:0`,
        );
      }
      tx.objectStore("snapshots").put(
        {
          schemaVersion: 1,
          privacyRevision: 0,
          year: 2025,
          timeZone: "Pacific/Auckland",
          coveredFrom: "2024-12-31T11:00:00Z",
          coveredThrough: "2025-12-31T11:00:00Z",
          completeYear: true,
          months: [420000, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
          listenedMs: 420000,
          qualifiedPlays: 1,
          activeDays: 1,
          topTracks: [],
          trackIds: [],
          visualSeed: "legacy-frozen",
        },
        "legacy",
      );
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  });
  await page.reload();
  await page.getByRole("tab", { name: "Your Recap", exact: true }).click();
  await expect(page.locator(".recap-total strong")).toHaveText("6");
  return cdp;
}
async function preference(page: Page) {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve) => {
      const r = indexedDB.open("local-music-v1", 1);
      r.onsuccess = () => resolve(r.result);
    });
    const value = await new Promise<Record<string, unknown>>((resolve) => {
      const r = db
        .transaction("settings")
        .objectStore("settings")
        .get("preferences");
      r.onsuccess = () => resolve(r.result);
    });
    db.close();
    return value.recapPeriod;
  });
}

test("calendar navigation, remembered timeframe and immutable legacy/new snapshots", async ({
  page,
}) => {
  await seed(page);
  const select = page.getByRole("combobox", { name: "Recap period" });
  await expect(select).toHaveValue("2026-01-01");
  await page.getByRole("button", { name: "Weekly", exact: true }).click();
  await expect(select).toHaveValue("2026-10-19");
  await expect(page.locator(".recap-total strong")).toHaveText("1");
  await expect(page.locator(".month-chart > div")).toHaveCount(7);
  await page
    .getByRole("button", { name: "Previous period", exact: true })
    .click();
  await expect(select).toHaveValue("2026-10-12");
  await expect(page.locator(".recap-total strong")).toHaveText("2");
  await page
    .getByRole("button", { name: "Current period", exact: true })
    .click();
  await expect(select).toHaveValue("2026-10-19");
  await page
    .getByRole("button", { name: "Save snapshot", exact: true })
    .click();
  await page.getByRole("button", { name: "Monthly", exact: true }).click();
  await expect(select).toHaveValue("2026-10-01");
  await expect(page.locator(".recap-total strong")).toHaveText("3");
  await expect(page.locator(".month-chart > div")).toHaveCount(31);
  await expect.poll(() => preference(page)).toBe("month");
  await page
    .getByRole("button", { name: "Saved snapshots", exact: true })
    .click();
  await page.locator(".snapshot-row").filter({ hasText: "2025" }).click();
  await expect(select).toHaveValue("2025-01-01");
  await expect(page.locator(".recap-total strong")).toHaveText("7");
  await expect.poll(() => preference(page)).toBe("month");
  const schema = await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve) => {
      const r = indexedDB.open("local-music-v1", 1);
      r.onsuccess = () => resolve(r.result);
    });
    return new Promise((resolve) => {
      const r = db
        .transaction("snapshots")
        .objectStore("snapshots")
        .get("legacy");
      r.onsuccess = () => {
        db.close();
        resolve(r.result.schemaVersion);
      };
    });
  });
  expect(schema).toBe(1);
  await page
    .getByRole("button", { name: "Return to live recap", exact: true })
    .click();
  await expect(select).toHaveValue("2025-01-01");
  await expect(page.locator(".recap-total strong")).toHaveText("0");
  await page
    .getByRole("button", { name: "Saved snapshots", exact: true })
    .click();
  await page.locator(".snapshot-row").filter({ hasText: "Oct 19" }).click();
  await expect(
    page.getByRole("button", { name: "Weekly", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".recap-total strong")).toHaveText("1");
  await page.reload();
  await page.getByRole("tab", { name: "Your Recap", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Monthly", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(select).toHaveValue("2026-10-01");
  await select.selectOption("2025-01-01");
  await expect(
    page.getByRole("button", { name: "Previous period", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Current period", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Next period", exact: true }),
  ).toBeDisabled();
});

test("delayed period reads never replace a newer selection and failed loading is retryable", async ({
  page,
}) => {
  await seed(page);
  await holdNextTrackRead(page);
  await page.getByRole("button", { name: "Weekly", exact: true }).click();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as unknown as { catalogReadHeld: boolean }).catalogReadHeld,
      ),
    )
    .toBe(true);
  await expect(page.locator(".recap-total")).toHaveCount(0);
  await page.getByRole("button", { name: "Monthly", exact: true }).click();
  await expect(page.locator(".recap-total strong")).toHaveText("3");
  await release(page);
  await expect(
    page.getByRole("combobox", { name: "Recap period" }),
  ).toHaveValue("2026-10-01");
  await expect(page.locator(".recap-total strong")).toHaveText("3");
  await page.evaluate(() => {
    const original = IDBObjectStore.prototype.getAll;
    IDBObjectStore.prototype.getAll = function (...args) {
      if (this.name === "tracks") {
        IDBObjectStore.prototype.getAll = original;
        throw new Error("Injected recap read failure");
      }
      return original.apply(this, args);
    };
  });
  await page.getByRole("button", { name: "Weekly", exact: true }).click();
  await expect(page.locator(".year-page [role=alert]")).toHaveText(
    "Injected recap read failure",
  );
  await expect(page.locator(".recap-total")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Saved snapshots", exact: true })
    .click();
  await page.locator(".snapshot-row").filter({ hasText: "2025" }).click();
  await expect(page.locator(".year-page [role=alert]")).toHaveCount(0);
  await expect(page.locator(".recap-total strong")).toHaveText("7");
  await page
    .getByRole("button", { name: "Return to live recap", exact: true })
    .click();
  await expect(page.locator(".recap-total strong")).toHaveText("0");
  await page.getByRole("button", { name: "Weekly", exact: true }).click();
  await page
    .getByRole("button", { name: "Refresh recap", exact: true })
    .click();
  await expect(page.locator(".recap-total strong")).toHaveText("1");
  await expect(page.locator(".year-page [role=alert]")).toHaveCount(0);
});

test("current weeks follow rollover and device zone; historical selection stays fixed", async ({
  page,
}) => {
  const cdp = await seed(page);
  await page.getByRole("button", { name: "Weekly", exact: true }).click();
  const select = page.getByRole("combobox", { name: "Recap period" });
  await expect(select).toHaveValue("2026-10-19");
  await page.clock.setFixedTime(new Date("2026-10-26T00:01:00Z"));
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(select).toHaveValue("2026-10-26");
  await page
    .getByRole("button", { name: "Previous period", exact: true })
    .click();
  await page.clock.setFixedTime(new Date("2026-11-02T00:01:00Z"));
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(select).toHaveValue("2026-10-19");
  await page.clock.setFixedTime(new Date("2026-11-01T23:30:00Z"));
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await page
    .getByRole("button", { name: "Current period", exact: true })
    .click();
  await expect(select).toHaveValue("2026-10-26");
  await cdp.send("Emulation.setTimezoneOverride", { timezoneId: "Asia/Tokyo" });
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(select).toHaveValue("2026-11-02");
});

test("weekly/monthly exports, EN/ES and narrow high-zoom layouts retain readable period data", async ({
  page,
}) => {
  await seed(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const kind of ["Weekly", "Monthly"] as const) {
    await page.getByRole("button", { name: kind, exact: true }).click();
    await expect(page.locator(".recap-total strong")).toHaveText(
      kind === "Weekly" ? "1" : "3",
    );
    for (const width of [390, 320, 575]) {
      await page.setViewportSize({ width, height: width === 575 ? 373 : 740 });
      await expect
        .poll(() =>
          page.evaluate(
            () => document.documentElement.scrollWidth - innerWidth,
          ),
        )
        .toBeLessThanOrEqual(1);
      await expect(
        page.getByRole("combobox", { name: "Recap period" }),
      ).toBeVisible();
    }
    await page
      .getByRole("button", { name: "Export image", exact: true })
      .click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.locator(".recap-image-preview")).toBeVisible();
    for (const format of ["Story", "Feed"]) {
      await dialog
        .getByRole("button", { name: new RegExp(`^${format}`) })
        .click();
      await expect(
        dialog.getByRole("button", { name: "Save PNG", exact: true }),
      ).toBeEnabled();
      const wait = page.waitForEvent("download");
      await dialog
        .getByRole("button", { name: "Save PNG", exact: true })
        .click();
      const download = await wait;
      expect(download.suggestedFilename()).toMatch(
        new RegExp(
          `^your-recap-${kind === "Weekly" ? "week-2026-10-19" : "month-2026-10-01"}-${format.toLowerCase()}\\.png$`,
        ),
      );
      const path = `artifacts/recap-period-${kind.toLowerCase()}-${format.toLowerCase()}.png`;
      await download.saveAs(path);
      const bytes = await readFile(path);
      expect([bytes.readUInt32BE(16), bytes.readUInt32BE(20)]).toEqual([
        2160,
        format === "Story" ? 3840 : 2700,
      ]);
    }
    await dialog.getByRole("button", { name: "Close", exact: true }).click();
  }
  await page.setViewportSize({ width: 390, height: 740 });
  await openSettings(page);
  await page.getByRole("button", { name: "Español", exact: true }).click();
  await page.getByRole("button", { name: "Oscuro", exact: true }).click();
  await page.getByRole("button", { name: "Cerrar", exact: true }).click();
  await expect(
    page.getByRole("tab", { name: "Tu resumen", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Mensual", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByRole("combobox", { name: "Periodo del resumen" }),
  ).toContainText("octubre de 2026");
  const scan = await new AxeBuilder({ page }).analyze();
  expect(scan.violations).toEqual([]);
  await page.screenshot({
    path: "artifacts/recap-period-es-mobile.png",
    fullPage: true,
  });
});
