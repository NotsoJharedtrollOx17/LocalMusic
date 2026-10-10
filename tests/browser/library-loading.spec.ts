import { test, expect, type Page } from "@playwright/test";

async function holdNextTrackRead(page: Page) {
  await page.evaluate(() => {
    const original = IDBObjectStore.prototype.getAll;
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    (window as unknown as { releaseCatalog: () => void }).releaseCatalog =
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
}
async function release(page: Page) {
  await page.evaluate(() =>
    (window as unknown as { releaseCatalog: () => void }).releaseCatalog(),
  );
}

test("saved dark theme and library tabs never show unfinished or mismatched results", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Explore with sample audio" }).click();
  await expect(page.getByText("8 songs", { exact: true })).toBeVisible();
  await page
    .locator(".sidebar")
    .getByRole("button", { name: "Settings", exact: true })
    .click();
  await page.getByLabel("Appearance", { exact: true }).selectOption("dark");
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem("local-music-theme")))
    .toBe("dark");
  await expect
    .poll(() =>
      page.evaluate(async () => {
        const db = await new Promise<IDBDatabase>((resolve) => {
          const r = indexedDB.open("local-music-v1", 1);
          r.onsuccess = () => resolve(r.result);
        });
        const theme = await new Promise<string>((resolve) => {
          const r = db
            .transaction("settings")
            .objectStore("settings")
            .get("preferences");
          r.onsuccess = () => resolve(r.result.theme);
        });
        db.close();
        return theme;
      }),
    )
    .toBe("dark");
  await page.addInitScript(() => {
    const observer = new MutationObserver(() => {
      if (document.querySelector(".app-shell")) {
        (
          window as unknown as { firstAppTheme: string | undefined }
        ).firstAppTheme = document.documentElement.dataset.theme;
        observer.disconnect();
      }
    });
    observer.observe(document, { subtree: true, childList: true });
    const original = IDBObjectStore.prototype.getAll;
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    (window as unknown as { releaseCatalog: () => void }).releaseCatalog =
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
  await page.reload();
  await expect(page.locator(".catalog-loading")).toBeVisible();
  expect(
    await page.evaluate(
      () => (window as unknown as { firstAppTheme: string }).firstAppTheme,
    ),
  ).toBe("dark");
  await expect(page.locator(".empty-library")).toHaveCount(0);
  await release(page);
  await expect(page.getByText("8 songs", { exact: true })).toBeVisible();

  await holdNextTrackRead(page);
  await page.getByRole("tab", { name: "Albums", exact: true }).click();
  await expect(page.locator(".album-placeholder")).toHaveCount(8);
  await expect(page.locator(".album-card")).toHaveCount(0);
  await expect(
    page.getByText("Albums appear when imported music has album tags.", {
      exact: true,
    }),
  ).toHaveCount(0);
  await release(page);
  await expect(page.locator(".album-card")).toHaveCount(4);
  const albums = await page.locator(".album-card strong").allTextContents();
  const subtitles = await page.locator(".album-card > span").allTextContents();

  await holdNextTrackRead(page);
  await page.getByRole("tab", { name: "Artists", exact: true }).click();
  await expect(page.locator(".album-placeholder")).toHaveCount(8);
  await expect(page.locator(".album-card")).toHaveCount(0);
  await release(page);
  await expect(page.locator(".album-card")).toHaveCount(4);
  const artists = await page.locator(".album-card strong").allTextContents();
  expect(artists).not.toEqual(albums);

  await holdNextTrackRead(page);
  await page.getByRole("tab", { name: "Albums", exact: true }).click();
  await expect(page.locator(".album-grid")).toHaveAttribute(
    "aria-busy",
    "true",
  );
  expect(await page.locator(".album-card strong").allTextContents()).toEqual(
    albums,
  );
  expect(await page.locator(".album-card > span").allTextContents()).toEqual(
    subtitles,
  );
  await page.getByRole("tab", { name: "Artists", exact: true }).click();
  expect(await page.locator(".album-card strong").allTextContents()).toEqual(
    artists,
  );
  await release(page);
  await expect(page.locator(".album-grid")).toHaveAttribute(
    "aria-busy",
    "false",
  );
  expect(await page.locator(".album-card strong").allTextContents()).toEqual(
    artists,
  );
  await page.getByRole("tab", { name: "Albums", exact: true }).click();
  await expect(page.locator(".album-grid")).toHaveAttribute(
    "aria-busy",
    "false",
  );
  expect(await page.locator(".album-card strong").allTextContents()).toEqual(
    albums,
  );
  await page.screenshot({
    path: "artifacts/library-tabs-dark.png",
    fullPage: true,
  });
});
