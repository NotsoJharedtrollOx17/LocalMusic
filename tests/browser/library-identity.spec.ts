import { taggedWav } from "./fixtures";
import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { readFileSync } from "node:fs";
const fixture = JSON.parse(
  readFileSync(
    new URL("../fixtures/library-identity.json", import.meta.url),
    "utf8",
  ),
);
import { openSettings } from "./navigationHelpers";
async function seed(page: Page, es = false) {
  await page.goto("/");
  await expect(
    page.getByRole("tab", { name: "Songs", exact: true }),
  ).toBeVisible();
  await page.evaluate(
    async ({ fixture, es }) => {
      const db = await new Promise<IDBDatabase>((resolve) => {
        const r = indexedDB.open("local-music-v1");
        r.onsuccess = () => resolve(r.result);
      });
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(
          ["tracks", "settings", "sessions", "playlists"],
          "readwrite",
        );
        for (const t of fixture.tracks)
          tx.objectStore("tracks").put(
            {
              ...t,
              identityMetadataRead: true,
              orderMetadataRead: true,
              releaseMetadataRead: true,
              file: new Blob([]),
            },
            t.id,
          );
        for (const s of fixture.sessions)
          tx.objectStore("sessions").put(s, s.id);
        tx.objectStore("settings").put(
          {
            language: es ? "es" : "en",
            theme: es ? "dark" : "light",
            timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            historyEnabledSince: "2026-01-01T00:00:00Z",
          },
          "preferences",
        );
        tx.objectStore("playlists").put(
          {
            id: "saved",
            title: "Copies",
            kind: "manual",
            trackIds: ["a", "b", "c"],
          },
          "saved",
        );
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
      db.close();
    },
    { fixture, es },
  );
  await page.reload();
  await expect(page.locator(".track-row")).not.toHaveCount(0);
}
async function open(page: Page, es = false) {
  await openSettings(page);
  await page
    .getByRole("button", {
      name: es ? "Organizar" : "Organize",
      exact: true,
    })
    .click();
  const d = page.getByRole("dialog", {
    name: es ? "Organizar" : "Organize",
    exact: true,
  });
  await expect(d.locator(".organization-body")).toBeVisible();
  return d;
}
async function close(page: Page) {
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
}
async function stored(page: Page) {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve) => {
      const r = indexedDB.open("local-music-v1");
      r.onsuccess = () => resolve(r.result);
    });
    return new Promise<any>((resolve) => {
      const tx = db.transaction(["organization", "playlists", "sessions"]),
        org = tx.objectStore("organization").get("state"),
        list = tx.objectStore("playlists").get("saved"),
        sessions = tx.objectStore("sessions").getAll();
      tx.oncomplete = () => {
        db.close();
        resolve({
          org: org.result,
          list: list.result,
          sessions: sessions.result,
        });
      };
    });
  });
}
test("lead artist corrections persist, reset and keep the original credit", async ({
  page,
}) => {
  await seed(page);
  let d = await open(page);
  await d.getByLabel("Search the library").fill("Earth");
  const row = d.locator(".organization-artist");
  await expect(row).toHaveCount(1);
  await row.getByLabel("Lead artist").fill("Corrected");
  await row.getByRole("button", { name: "Save", exact: true }).click();
  await expect(d.getByRole("status")).toContainText("Organization saved");
  await expect(
    row.getByText("Original credit: Earth, Wind & Fire"),
  ).toBeVisible();
  await close(page);
  await page.getByRole("tab", { name: "Artists", exact: true }).click();
  await expect(
    page.locator(".album-card").filter({ hasText: "Corrected" }),
  ).toHaveCount(1);
  await page.reload();
  d = await open(page);
  await d.getByLabel("Search the library").fill("Earth");
  await expect(d.getByLabel("Lead artist")).toHaveValue("Corrected");
  await d.getByRole("button", { name: "Reset", exact: true }).click();
  await expect(d.getByLabel("Lead artist")).toHaveValue("Earth, Wind & Fire");
});
test("reviewed song links support preferred copies, explicit cleanup and Undo without rewriting history", async ({
  page,
}) => {
  await seed(page);
  const d = await open(page);
  await d.getByRole("button", { name: "Songs", exact: true }).click();
  await d.getByLabel("Search the library").fill("Orbit");
  await d.locator('[data-track-id="a"]').getByRole("checkbox").check();
  await d.locator('[data-track-id="b"]').getByRole("checkbox").check();
  await d.getByLabel("Preferred copy").selectOption("b");
  await d.getByRole("button", { name: "Link copies", exact: true }).click();
  await expect(d.getByRole("status")).toContainText("Organization saved");
  let data = await stored(page);
  expect(data.org.songs[0].preferred).toBe("b");
  expect(data.list.trackIds).toEqual(["a", "b", "c"]);
  expect(data.sessions).toHaveLength(3);
  await d.getByRole("button", { name: "Preview", exact: true }).click();
  await expect(
    d.getByText("Copies: 1 repeated entries to remove"),
  ).toBeVisible();
  await d.getByRole("button", { name: "Apply cleanup", exact: true }).click();
  expect((await stored(page)).list.trackIds).toEqual(["a", "c"]);
  await d.getByRole("button", { name: "Undo", exact: true }).click();
  expect((await stored(page)).list.trackIds).toEqual(["a", "b", "c"]);
  await d.getByRole("button", { name: "Unlink", exact: true }).click();
  expect((await stored(page)).org.songs).toHaveLength(0);
});
test("confirmed album aliases form one searchable card and unlink restores original groups", async ({
  page,
}) => {
  await seed(page);
  const d = await open(page);
  await d.getByRole("button", { name: "Albums", exact: true }).click();
  await d.getByLabel("Search the library").fill("First");
  const choice = (name: string) =>
    d
      .locator(".organization-choice")
      .filter({ has: page.getByText(name, { exact: true }) })
      .getByRole("checkbox");
  await choice("First").check();
  await choice("First album").check();
  await d.getByLabel("Album name").fill("Canonical release");
  await d.getByRole("button", { name: "Link albums", exact: true }).click();
  await expect(d.getByRole("status")).toContainText("Organization saved");
  await close(page);
  await page.getByRole("tab", { name: "Albums", exact: true }).click();
  await expect(page.locator(".collection-count")).toHaveText("5 albums");
  await page
    .locator(".album-card")
    .filter({ hasText: "Canonical release" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Canonical release", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".track-row")).toHaveCount(4);
  await page.setViewportSize({ width: 320, height: 600 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
  await page
    .getByRole("button", { name: "Organize", exact: true })
    .click();
  const organization = page.getByRole("dialog", {
    name: "Organize",
    exact: true,
  });
  await expect(
    organization.getByRole("button", { name: "Unlink", exact: true }),
  ).toBeVisible();
  await organization
    .getByRole("button", { name: "Unlink", exact: true })
    .click();
  expect((await stored(page)).org.albums).toHaveLength(0);
});
test("Spanish dark narrow organization remains reachable, accessible and within one dialog", async ({
  page,
}) => {
  await seed(page, true);
  await page.setViewportSize({ width: 320, height: 600 });
  const d = await open(page, true);
  await expect(page.getByRole("dialog")).toHaveCount(1);
  for (const name of ["Artistas", "Canciones", "Álbumes"]) {
    await d.getByRole("button", { name, exact: true }).click();
    expect(await d.evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(
      true,
    );
  }
  expect(
    (await new AxeBuilder({ page }).include(".organization").analyze())
      .violations,
  ).toEqual([]);
  await page.screenshot({
    path: "artifacts/library-identity/organization-es-dark-320.png",
  });
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("dialog", { name: "Ajustes", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Organizar", exact: true }),
  ).toBeFocused();
});

test("failed organization persistence retains metadata and Retry permits a fresh save", async ({
  page,
}) => {
  await seed(page);
  const d = await open(page);
  await d.getByLabel("Search the library").fill("Earth");
  await d.getByLabel("Lead artist").fill("Changed");
  await page.evaluate(() => {
    const original = IDBObjectStore.prototype.put;
    let fail = true;
    IDBObjectStore.prototype.put = function (...args: any[]) {
      if (this.name === "organization" && fail) {
        fail = false;
        throw new DOMException(
          "Forced organization write failure",
          "QuotaExceededError",
        );
      }
      return Reflect.apply(original, this, args);
    };
  });
  await d.getByRole("button", { name: "Save", exact: true }).click();
  await expect(d.getByRole("alert")).toContainText(
    "Forced organization write failure",
  );
  expect((await stored(page)).org).toBeUndefined();
  await d.getByRole("button", { name: "Retry", exact: true }).click();
  await expect(d.getByRole("alert")).toHaveCount(0);
  await d.getByRole("button", { name: "Save", exact: true }).click();
  await expect(d.getByRole("status")).toContainText("Organization saved");
  expect((await stored(page)).org.artists.g).toBe("Changed");
});

test("real tagged imports group featuring credits under the lead artist without splitting band names", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator(".empty-library")).toBeVisible();
  await page
    .locator("input[type=file]")
    .first()
    .setInputFiles([
      {
        name: "collab.wav",
        mimeType: "audio/wav",
        buffer: taggedWav("Collab", 101, 1, {
          artist: "Lead feat. Guest",
          album: "Album",
        }),
      },
      {
        name: "solo.wav",
        mimeType: "audio/wav",
        buffer: taggedWav("Solo", 102, 1, { artist: "Lead", album: "Album" }),
      },
      {
        name: "band.wav",
        mimeType: "audio/wav",
        buffer: taggedWav("Band song", 103, 1, {
          artist: "AC/DC",
          album: "Other",
        }),
      },
    ]);
  await expect(page.locator(".track-row")).toHaveCount(3);
  await page.getByRole("tab", { name: "Artists", exact: true }).click();
  await expect(page.locator(".collection-count")).toHaveText("2 artists");
  await expect(
    page.locator(".album-card").filter({ hasText: "Lead feat." }),
  ).toHaveCount(0);
  await expect(
    page.locator(".album-card").filter({ hasText: "AC/DC" }),
  ).toHaveCount(1);
  await page.getByRole("tab", { name: "Albums", exact: true }).click();
  await expect(page.locator(".collection-count")).toHaveText("2 albums");
  await page
    .locator(".album-card")
    .filter({ has: page.getByText("Album", { exact: true }) })
    .click();
  await expect(page.locator(".track-row")).toHaveCount(2);
  await expect(
    page.getByText("Lead feat. Guest", { exact: true }),
  ).toBeVisible();
  await expect(page.locator('.track-row .album-label')).toHaveCount(0);
  await page.locator('.group-back').click();
  await page.locator('input[type=file]').first().setInputFiles({name:'collab.wav',mimeType:'audio/wav',buffer:taggedWav('Collab',101,1,{artist:'Lead feat. Guest',album:'Album'})});
  await expect(page.getByText('No new songs imported.',{exact:true})).toBeVisible();
  await page.getByRole('tab',{name:'Songs',exact:true}).click();
  await expect(page.locator('.track-row')).toHaveCount(3);

});
