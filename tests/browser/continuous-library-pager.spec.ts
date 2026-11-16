import { test, expect, type Page } from "@playwright/test";
import fixture from "../fixtures/catalog-index.json" with { type: "json" };
import { taggedWav } from "./fixtures";
import { writeFile } from "node:fs/promises";

test.use({ hasTouch: true, viewport: { width: 390, height: 844 } });
const pane = (page: Page) => page.locator('.library-pane[data-active="true"]');
const pointer = (x: number, y = 350) => ({
  pointerType: "touch",
  pointerId: 51,
  isPrimary: true,
  clientX: x,
  clientY: y,
});
async function seed(page: Page, count: number, oneArtist = false) {
  await page.goto("/");
  await page.getByRole("tab", { name: "Songs", exact: true }).waitFor();
  await page.evaluate(
    async ({ count, track, wav, oneArtist }) => {
      const db = await new Promise<IDBDatabase>((resolve) => {
        const r = indexedDB.open("local-music-v1");
        r.onsuccess = () => resolve(r.result);
      });
      const file = new Blob([new Uint8Array(wav)], { type: "audio/wav" });
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction("tracks", "readwrite");
        for (let i = 0; i < count; i++) {
          const id = `index-${String(i).padStart(5, "0")}`;
          tx.objectStore("tracks").put(
            {
              ...track,
              id,
              title: `Song ${String(i).padStart(5, "0")}`,
              album: `Album ${String(Math.floor(i / 10)).padStart(4, "0")}`,
              artist: oneArtist
                ? "One artist"
                : `Artist ${String(Math.floor(i / 5)).padStart(4, "0")}`,
              artworkUrl: undefined,
              file,
              importSequence: i,
            },
            id,
          );
        }
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
      db.close();
    },
    {
      count,
      track: fixture.track,
      oneArtist,
      wav: [...taggedWav("Catalog", 0, 0.01)],
    },
  );
  await page.addInitScript(() => {
    const state = {
      reads: 0,
      completions: [] as Array<{ count: number; ms: number }>,
    };
    Object.assign(window, { catalogProbe: state });
    const original = IDBObjectStore.prototype.getAll;
    IDBObjectStore.prototype.getAll = function (...args) {
      const start = performance.now();
      if (this.name === "tracks") state.reads++;
      const request = original.apply(this, args);
      if (this.name === "tracks")
        request.addEventListener("success", () =>
          state.completions.push({
            count: request.result.length,
            ms: performance.now() - start,
          }),
        );
      return request;
    };
  });
  await page.reload();
  await expect(page.locator("#library-content [data-virtual-count]"))
    .toHaveAttribute("data-virtual-count", String(count), { timeout: 30000 })
    .catch(async (error) => {
      console.log(
        "INDEX-DIAGNOSTIC",
        await page.evaluate(() => ({
          probe: (window as unknown as { catalogProbe: unknown }).catalogProbe,
          body: document.body.innerText.slice(-1000),
        })),
      );
      throw error;
    });
}

for (const count of fixture.sizes) {
  test(`${count} tracks have their full scroll range before the first fling, without metadata paging`, async ({
    page,
  }) => {
    await seed(page, count);
    await page.waitForTimeout(500);
    const readyObservationMs = await page.evaluate(() => performance.now());
    const reads = () =>
      page.evaluate(
        () =>
          (window as unknown as { catalogProbe: { reads: number } })
            .catalogProbe.reads,
      );
    const initialReads = await reads();
    expect(await pane(page).evaluate((el) => el.scrollHeight)).toBeGreaterThan(
      count * 60,
    );
    for (const fraction of [1, 0.25, 0.9, 0, 1]) {
      await pane(page).evaluate(
        (el, fraction) =>
          el.scrollTo({ top: el.scrollHeight * fraction, behavior: "instant" }),
        fraction,
      );
      await expect
        .poll(() => pane(page).locator(".track-row").count())
        .toBeGreaterThan(0);
      expect(await pane(page).locator(".track-row").count()).toBeLessThan(140);
      expect(await page.locator(".library-pane").count()).toBeLessThanOrEqual(
        3,
      );
      await page.waitForTimeout(120);
    }
    await expect(
      pane(page).locator(
        `[data-track-id="index-${String(count - 1).padStart(5, "0")}"]`,
      ),
    ).toBeInViewport();
    expect(await reads()).toBe(initialReads);
    await expect(
      page.getByRole("button", { name: "Load more", exact: true }),
    ).toHaveCount(0);
    await page.screenshot({
      path: `artifacts/continuous-library-pager/browser-${count}-last.png`,
    });
    await writeFile(
      `artifacts/continuous-library-pager/browser-${count}-metrics.json`,
      JSON.stringify({
        count,
        readyObservationMsSinceNavigation: readyObservationMs,
        metadata: await page.evaluate(() => (window as unknown as {
          catalogProbe: unknown;
        }).catalogProbe),
        mountedRows: await pane(page).locator(".track-row").count(),
        panes: await page.locator(".library-pane").count(),
        metadataReadsDuringReadyScrolling: (await reads()) - initialReads,
      }, null, 2),
    );
  });
}

test("a drag exposes real neighboring cards, keeps the XMB strip fixed and never wraps", async ({
  page,
}) => {
  await seed(page, 711);
  const panel = page.locator(".library-page"),
    tabs = page.locator(".section-tabs");
  const before = (await tabs.boundingBox())!;
  await panel.dispatchEvent("pointerdown", pointer(320));
  await panel.dispatchEvent("pointermove", pointer(200));
  const neighbor = page.locator('.library-pane[data-pane="albums"]');
  await expect(neighbor).toHaveAttribute("inert", "");
  const bounds = (await neighbor.locator(".album-card").first().boundingBox())!;
  expect(bounds.x).toBeLessThan(390);
  expect(bounds.x).toBeGreaterThan(200);
  expect((await tabs.boundingBox())!.x).toBe(before.x);
  await page.screenshot({
    path: "artifacts/continuous-library-pager/browser-mid-swipe.png",
  });
  await panel.dispatchEvent("pointerup", pointer(200));
  await expect(page.locator("#tab-albums")).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await page.waitForTimeout(200);
  await pane(page).locator(".album-card").first().tap();
  await expect(page.locator("#library-content .collection-hero")).toBeVisible();
  await page.locator(".group-back").tap();
  await page.locator("#tab-songs").click();
  await panel.dispatchEvent("pointerdown", pointer(120));
  await panel.dispatchEvent("pointermove", pointer(300));
  await panel.dispatchEvent("pointerup", pointer(300));
  await expect(page.locator("#tab-songs")).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await page.locator("#tab-year").click();
  await panel.dispatchEvent("pointerdown", pointer(300));
  await panel.dispatchEvent("pointermove", pointer(80));
  await panel.dispatchEvent("pointerup", pointer(80));
  await expect(page.locator("#tab-year")).toHaveAttribute(
    "aria-selected",
    "true",
  );
});

test("deep positions survive adjacent tabs and first taps work immediately after tab selection", async ({
  page,
}) => {
  await seed(page, 711);
  await pane(page).evaluate((el) => el.scrollTo(0, 24000));
  await page.waitForTimeout(100);
  const anchor = await pane(page).evaluate((el) => {
    const top = el.getBoundingClientRect().top;
    const row = [
      ...el.querySelectorAll<HTMLElement>("[data-library-key]"),
    ].find((row) => row.getBoundingClientRect().bottom > top + 1)!;
    return {
      key: row.dataset.libraryKey!,
      offset: row.getBoundingClientRect().top - top,
    };
  });
  await page.locator("#tab-albums").click();
  await pane(page).locator(".album-card").first().tap();
  await expect(page.locator("#library-content .collection-hero")).toBeVisible();
  await page.locator(".group-back").click();
  await page.locator("#tab-songs").click();
  await expect
    .poll(() =>
      pane(page).evaluate((el, anchor) => {
        const row = el.querySelector<HTMLElement>(
          `[data-library-key="${CSS.escape(anchor.key)}"]`,
        );
        return row
          ? Math.abs(
              row.getBoundingClientRect().top -
                el.getBoundingClientRect().top -
                anchor.offset,
            )
          : 9999;
      }, anchor),
    )
    .toBeLessThan(2);
  await expect(page.locator(".mini-player")).toHaveCount(0);
});

test("an artist's complete album subview stays virtualized and returns to its last album", async ({
  page,
}) => {
  await seed(page, 1000, true);
  await page.locator("#tab-artists").click();
  await pane(page).locator(".album-card").first().tap();
  await page.getByRole("tab", { name: "Albums", exact: true }).click();
  await expect(pane(page).locator(".album-grid")).toHaveAttribute(
    "data-catalog-total",
    "100",
  );
  await pane(page).evaluate((el) => el.scrollTo(0, el.scrollHeight));
  const last = pane(page)
    .locator(".album-card")
    .filter({ has: page.locator("strong", { hasText: "Album 0099" }) });
  await expect(last).toBeInViewport();
  expect(await pane(page).locator(".album-card").count()).toBeLessThan(60);
  const key = await last.getAttribute("data-group-key");
  await last.tap();
  await expect(page.locator(".collection-hero h1")).toHaveText("Album 0099");
  await page.locator(".group-back").tap();
  await expect(
    page.locator(`#library-content [data-group-key="${key}"]`),
  ).toBeFocused();
  await expect(page.locator(".mini-player")).toHaveCount(0);
});
