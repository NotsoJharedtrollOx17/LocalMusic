import { test, expect, type Page } from "@playwright/test";
import { openEqualizer, openSettings } from "./navigationHelpers";
import fixtures from "../fixtures/sound-normalization.json" with { type: "json" };

async function stored(page: Page) {
  return page.evaluate(
    () =>
      new Promise<any>((resolve, reject) => {
        const open = indexedDB.open("local-music-v1", 1);
        open.onsuccess = () => {
          const db = open.result,
            request = db
              .transaction("settings")
              .objectStore("settings")
              .get("sound-v1");
          request.onsuccess = () => {
            resolve(request.result);
            db.close();
          };
          request.onerror = () => reject(request.error);
        };
        open.onerror = () => reject(open.error);
      }),
  );
}
async function seed(page: Page, value: unknown) {
  await page.evaluate(
    (value) =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open("local-music-v1", 1);
        open.onsuccess = () => {
          const db = open.result,
            tx = db.transaction("settings", "readwrite");
          tx.objectStore("settings").put(value, "sound-v1");
          tx.oncomplete = () => {
            resolve();
            db.close();
          };
          tx.onerror = () => reject(tx.error);
        };
      }),
    value,
  );
}

test("upgrade deletes active and malformed profiles, retaining ordinary EQ and direct localized navigation", async ({
  page,
}) => {
  await page.goto("/");
  await openEqualizer(page);
  await page.keyboard.press("Escape");
  for (const name of [
    "active profile restores the last ordinary Rock preset",
    "malformed retired fields cannot block ordinary EQ",
  ]) {
    const fixture = fixtures.find((row) => row.name === name)!;
    await seed(page, fixture.input);
    await page.reload();
    await expect.poll(() => stored(page)).toEqual(fixture.expected);
    const eq = await openEqualizer(page);
    await expect(page.getByRole("dialog")).toHaveCount(1);
    await expect(eq.getByRole("slider")).toHaveCount(9);
    const values = await eq
      .getByRole("slider")
      .evaluateAll((nodes) =>
        nodes.map((node) => Number((node as HTMLInputElement).value)),
      );
    expect(values).toEqual(fixture.expected.gains.slice(1));
    await expect(eq).not.toContainText(/Adapt Sound|profile|headphones/i);
    await page.keyboard.press("Escape");
    await expect(
      page.getByRole("button", { name: "Library actions", exact: true }),
    ).toBeFocused();
    await page.reload();
    await expect.poll(() => stored(page)).toEqual(fixture.expected);
  }
  const settings = await openSettings(page);
  await settings.getByRole("button", { name: "Español", exact: true }).click();
  await settings.getByRole("button", { name: "Oscuro", exact: true }).click();
  await page.keyboard.press("Escape");
  await page.setViewportSize({ width: 320, height: 568 });
  const eq = await openEqualizer(page);
  await expect(eq).toHaveAccessibleName("Ecualizador");
  await expect(eq.getByRole("slider")).toHaveCount(9);
  await page.evaluate(() => window.__musicBack?.());
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByRole("button", {
      name: "Acciones de la biblioteca",
      exact: true,
    }),
  ).toBeFocused();
});

test("migration write failures keep legacy storage intact and Retry completes deletion", async ({
  page,
}) => {
  await page.goto("/");
  await openEqualizer(page);
  await page.keyboard.press("Escape");
  const fixture = fixtures.find(
    (row) =>
      row.name === "active profile restores the last ordinary Rock preset",
  )!;
  await seed(page, fixture.input);
  await page.addInitScript(() => {
    const original = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (value, key) {
      if (this.name === "settings" && key === "sound-v1") {
        IDBObjectStore.prototype.put = original;
        throw new Error("Migration write blocked");
      }
      return original.call(this, value, key!);
    };
  });
  await page.reload();
  const eq = await openEqualizer(page);
  await expect(eq.getByRole("alert")).toContainText("Migration write blocked");
  expect(await stored(page)).toEqual(fixture.input);
  await expect(eq.getByRole("slider")).toHaveCount(9);
  await eq
    .getByRole("button", { name: "Retry audio output", exact: true })
    .click();
  await expect.poll(() => stored(page)).toEqual(fixture.expected);
  await expect(eq.getByRole("alert")).toHaveCount(0);
});
