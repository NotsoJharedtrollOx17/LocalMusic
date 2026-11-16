import { test, expect } from "@playwright/test";
import { seedInlineCatalog } from "./inlineSearchFixture";

test("Spanish export actions reflow at 320px with enlarged text and reduced motion", async ({
  page,
}) => {
  await seedInlineCatalog(page);
  await expect(page.locator(".brand-symbol svg")).toHaveCount(1);
  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve) => {
      const r = indexedDB.open("local-music-v1");
      r.onsuccess = () => resolve(r.result);
    });
    await new Promise<void>((resolve) => {
      const tx = db.transaction(
          ["settings", "sessions", "intervals"],
          "readwrite",
        ),
        store = tx.objectStore("settings"),
        r = store.get("preferences");
      const startUtc = new Date(Date.now() - 60000).toISOString();
      r.onsuccess = () =>
        store.put(
          { ...r.result, language: "es", historyEnabledSince: startUtc },
          "preferences",
        );
      tx.objectStore("sessions").put(
        {
          id: "export-fixture",
          trackId: "entry-0",
          startedAtUtc: startUtc,
          playedMs: 30000,
          qualified: true,
          excluded: false,
          demo: false,
        },
        "export-fixture",
      );
      tx.objectStore("intervals").put(
        { sessionId: "export-fixture", sequence: 0, startUtc, playedMs: 30000 },
        "export-fixture",
      );
      tx.oncomplete = () => resolve();
    });
    db.close();
  });
  await page.setViewportSize({ width: 320, height: 640 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.reload();
  await page.getByRole("tab", { name: "Tu resumen", exact: true }).click();
  await page.evaluate(() => {
    Object.defineProperty(navigator, "canShare", {
      configurable: true,
      value: () => true,
    });
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: async () => {
        throw new DOMException("Canceled", "AbortError");
      },
    });
  });
  await page
    .getByRole("button", { name: "Exportar imagen", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await page.addStyleTag({
    content: ".share-recap .button { font-size: 20px; }",
  });
  const save = dialog.getByRole("button", { name: "Guardar PNG", exact: true });
  const share = dialog.getByRole("button", {
    name: "Compartir imagen",
    exact: true,
  });
  await expect(save).toBeEnabled({ timeout: 30000 });
  await expect(save).toBeInViewport();
  await expect(share).toBeInViewport();
  const bounds = await share.boundingBox();
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(320);
  expect(await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(
    true,
  );
  await share.click();
  await expect(share).toBeEnabled();
  await expect(dialog.locator(".recap-save-toast")).toHaveCount(0);
  await expect(dialog.getByRole("alert")).toHaveCount(0);
  await page.screenshot({
    path: "artifacts/branding-export/browser-spanish-320.png",
  });
});
