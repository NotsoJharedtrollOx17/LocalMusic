import { expect, type Page } from "@playwright/test";
import { aggregate } from "../../src/domain";
import { localDate } from "../../src/recap/calendar";
import type { Interval, Session, Settings, Track } from "../../src/types";

/** Seed an existing snapshot: the application no longer exposes a Save snapshot action. */
export async function seedExistingSnapshot(page: Page) {
  const data = await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve) => {
      const r = indexedDB.open("local-music-v1");
      r.onsuccess = () => resolve(r.result);
    });
    const read = (store: string, key?: string) =>
      new Promise<any>((resolve) => {
        const s = db.transaction(store).objectStore(store);
        const r = key ? s.get(key) : s.getAll();
        r.onsuccess = () => resolve(r.result);
      });
    const [settings, tracks, sessions, intervals] = await Promise.all([
      read("settings", "preferences"),
      read("tracks"),
      read("sessions"),
      read("intervals"),
    ]);
    db.close();
    return {
      settings: settings as Settings,
      tracks: tracks as Track[],
      sessions: sessions as Session[],
      intervals: intervals as Interval[],
      now: new Date().toISOString(),
    };
  });
  const recap = aggregate(
    {
      kind: data.settings.recapPeriod ?? "year",
      anchorDate: localDate(new Date(data.now), data.settings.timeZone),
    },
    data.settings,
    data.tracks,
    data.sessions,
    data.intervals,
    new Date(data.now),
  );
  await page.evaluate(async (recap) => {
    const db = await new Promise<IDBDatabase>((resolve) => {
      const r = indexedDB.open("local-music-v1");
      r.onsuccess = () => resolve(r.result);
    });
    await new Promise<void>((resolve) => {
      const tx = db.transaction("snapshots", "readwrite");
      tx.objectStore("snapshots").put(recap, crypto.randomUUID());
      tx.oncomplete = () => resolve();
    });
    db.close();
  }, recap);
  await page
    .getByRole("button", { name: "Refresh recap", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Saved snapshots", exact: true })
    .click();
  await expect(
    page.getByRole("dialog").locator(".snapshot-row").first(),
  ).toBeVisible();
  await page.keyboard.press("Escape");
}
