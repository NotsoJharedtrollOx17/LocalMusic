import { openSettings } from "./navigationHelpers";
import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import AxeBuilder from "@axe-core/playwright";

test("social recap preview is the saved image and snapshots select their own year", async ({
  page,
}) => {
  const lastYear = new Date().getFullYear() - 1;
  await page.goto("/");
  await page.evaluate(async (year) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const r = indexedDB.open("local-music-v1", 1);
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(
        ["tracks", "settings", "sessions", "intervals"],
        "readwrite",
      );
      tx.objectStore("settings").put(
        {
          language: "en",
          theme: "light",
          timeZone: "UTC",
          historyEnabledSince: year + "-01-01T00:00:00Z",
          privacyRevision: 0,
        },
        "preferences",
      );
      tx.objectStore("tracks").put(
        {
          id: "recap-fixture",
          title:
            "Starlight — Live from the Midnight Assembly and Northern Lights",
          artist: "The Midnight Assembly & Northern Lights Orchestra",
          album: "A Year Between the City and the Stars (Expanded Edition)",
          genre: "Rock",
          durationMs: 300000,
          sourceUri: "private-fixture-path",
          favorite: false,
          available: true,
          file: new Blob(),
          orderMetadataRead: true,
          releaseMetadataRead: true,
        },
        "recap-fixture",
      );
      [
        1200, 1500, 2000, 1800, 2200, 1600, 1700, 2100, 1900, 1600, 1800, 2204,
      ].forEach((minutes, i) => {
        const id = "recap-session-" + i,
          startUtc =
            year + "-" + String(i + 1).padStart(2, "0") + "-15T12:00:00Z";
        tx.objectStore("sessions").put(
          {
            id,
            trackId: "recap-fixture",
            startedAtUtc: startUtc,
            playedMs: minutes * 60000,
            excluded: false,
          },
          id,
        );
        tx.objectStore("intervals").put(
          { sessionId: id, sequence: 0, startUtc, playedMs: minutes * 60000 },
          id + ":0",
        );
      });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  }, lastYear);
  await page.reload();
  await page.getByRole("tab", { name: "Your Year", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Export image", exact: true }),
  ).toBeDisabled();
  await page.locator(".year-controls select").selectOption(String(lastYear));
  await expect(page.locator(".recap-total strong")).toHaveText("21,604");
  await page.getByRole("button", { name: "Export image", exact: true }).click();
  const share = page.getByRole("dialog", { name: "Export image" });
  await expect(share.locator(".recap-image-preview")).toBeVisible();
  const bytes = await share
    .locator(".recap-image-preview")
    .evaluate(async (img) =>
      Array.from(
        new Uint8Array(
          await (await fetch((img as HTMLImageElement).src)).arrayBuffer(),
        ),
      ),
    );
  const waiting = page.waitForEvent("download");
  await share.getByRole("button", { name: "Save PNG", exact: true }).click();
  const saved = await waiting;
  const downloaded = await readFile((await saved.path())!);
  expect(downloaded.equals(Buffer.from(bytes))).toBe(true);
  await saved.saveAs("artifacts/recap-design-story.png");
  await share.getByRole("button", { name: "Feed · 4:5" }).click();
  await expect(
    share.getByRole("button", { name: "Save PNG", exact: true }),
  ).toBeEnabled();
  const feedWait = page.waitForEvent("download");
  await share.getByRole("button", { name: "Save PNG", exact: true }).click();
  await (await feedWait).saveAs("artifacts/recap-design-feed.png");
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.screenshot({ path: "artifacts/recap-share-mobile.png" });
  await share.getByRole("button", { name: "Close", exact: true }).click();
  await page
    .getByRole("button", { name: "Save snapshot", exact: true })
    .click();
  await expect(page.getByText("Snapshot saved", { exact: true })).toBeVisible();
  await page
    .locator(".year-controls select")
    .selectOption(String(lastYear + 1));
  await page
    .getByRole("button", { name: "Saved snapshots", exact: true })
    .click();
  await page.getByRole("dialog").locator(".snapshot-row").first().click();
  await expect(page.locator(".year-controls select")).toHaveValue(
    String(lastYear),
  );
  await expect(page.locator(".recap-total strong")).toHaveText("21,604");
  await expect(
    page.getByRole("button", { name: "Return to live recap", exact: true }),
  ).toBeVisible();
  await openSettings(page);
  await page.getByRole("button", { name: "Espa\u00f1ol", exact: true }).click();
  await page.getByRole("button", { name: "Cerrar", exact: true }).click();
  await page
    .getByRole("button", { name: "Exportar imagen", exact: true })
    .click();
  const spanish = page.getByRole("dialog", { name: "Exportar imagen" });
  await expect(spanish.locator(".recap-image-preview")).toBeVisible();
  const spanishWait = page.waitForEvent("download");
  await spanish
    .getByRole("button", { name: "Guardar PNG", exact: true })
    .click();
  await (await spanishWait).saveAs("artifacts/recap-design-es.png");
  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve) => {
      const r = indexedDB.open("local-music-v1", 1);
      r.onsuccess = () => resolve(r.result);
    });
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("settings", "readwrite"),
        store = tx.objectStore("settings"),
        r = store.get("preferences");
      r.onsuccess = () =>
        store.put(
          { ...r.result, privacyRevision: (r.result.privacyRevision ?? 0) + 1 },
          "preferences",
        );
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  });
  let unexpectedDownloads = 0;
  page.on("download", () => unexpectedDownloads++);
  await spanish
    .getByRole("button", { name: "Guardar PNG", exact: true })
    .click();
  await expect(spanish.getByRole("alert")).toContainText(
    "La privacidad del historial cambió",
  );
  expect(unexpectedDownloads).toBe(0);
  await spanish.getByRole("button", { name: "Cerrar", exact: true }).click();
  await openSettings(page);
  page.once("dialog", async (dialog) => {
    await dialog.accept();
  });
  await page
    .getByRole("button", { name: "Borrar historial", exact: true })
    .click();
  await expect(page.locator(".year-controls select")).toHaveValue(
    String(lastYear + 1),
  );
  await expect(page.locator(".recap-total strong")).toHaveText("0");
  await page.getByRole("button", { name: "Cerrar", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Exportar imagen", exact: true }),
  ).toBeDisabled();
});
