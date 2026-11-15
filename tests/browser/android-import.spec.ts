import { test, expect, type Page, type BrowserContext } from "@playwright/test";
import { DetachedFixture } from "./detached-window-fixture";

async function importing(page: Page, context: BrowserContext) {
  const native = new DetachedFixture(context);
  await native.attach(page);
  let finish!: (n: number) => void;
  let fail!: (e: Error) => void;
  let releaseRefresh: (() => void) | undefined;
  let holdRefresh = false;
  let cancelled = false;
  await page.exposeBinding("__importCommand", async (_, command: string) => {
    if (command === "import_music")
      return new Promise<number>((resolve, reject) => {
        finish = resolve;
        fail = reject;
      });
    if (command === "cancel_import") {
      cancelled = true;
      await native.emit("catalog://progress", {
        imported: 0,
        failed: 0,
        cancelled: true,
      });
      finish(0);
    }
    if (command === "list_tracks") {
      if (holdRefresh)
        await new Promise<void>((resolve) => {
          releaseRefresh = resolve;
        });
      return { tracks: native.tracks, total: native.tracks.length };
    }
  });
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "userAgent", {
      get: () => "Android import test",
    });
    const win = window as any,
      original = win.__TAURI_INTERNALS__.invoke;
    win.__TAURI_INTERNALS__.invoke = (command: string, args: any) =>
      ["import_music", "cancel_import", "list_tracks"].includes(command)
        ? win.__importCommand(command, args)
        : original(command, args);
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.getByText("1 song", { exact: true })).toBeVisible();
  const start = async () => {
    await page
      .getByRole("button", { name: "Import music", exact: true })
      .click();
    await expect(page.locator(".import-status")).toContainText(
      "Checking music files",
    );
  };
  return {
    native,
    start,
    finish: (n: number) => finish(n),
    fail: () => fail(Error("Music index unavailable")),
    hold: () => {
      holdRefresh = true;
    },
    release: () => {
      holdRefresh = false;
      releaseRefresh?.();
    },
    refreshHeld: () => !!releaseRefresh,
    cancelled: () => cancelled,
  };
}

test("Android scan reports file checks before saving and waits for final catalog refresh", async ({
  page,
  context,
}) => {
  const f = await importing(page, context);
  await f.start();
  const status = page.locator(".import-status");
  await f.native.emit("catalog://progress", {
    phase: "checking",
    imported: 0,
    scanned: 12,
    total: 714,
    failed: 3,
  });
  await expect(status).toContainText("12 of 714 files checked");
  await expect(status).toContainText("3 files skipped");
  await expect(status).not.toContainText("0 tracks imported");
  f.native.tracks.push({
    ...f.native.tracks[0],
    id: "two",
    title: "Imported song",
  });
  f.hold();
  await f.native.emit("catalog://progress", {
    phase: "saving",
    imported: 2,
    failed: 3,
  });
  f.finish(2);
  await expect(status).toContainText("Updating your library");
  await expect(page.locator(".toast")).toHaveCount(0);
  await expect.poll(f.refreshHeld).toBe(true);
  f.release();
  await expect(page.getByText("2 songs", { exact: true })).toBeVisible();
  await expect(page.locator(".toast")).toContainText(
    "2 tracks imported · 3 files skipped",
  );
  await expect(status).toHaveCount(0);
});

test("empty and unreadable scans stay honest and allow retry", async ({
  page,
  context,
}) => {
  const f = await importing(page, context);
  await f.start();
  await f.native.emit("catalog://progress", {
    phase: "checking",
    imported: 0,
    scanned: 4,
    total: 4,
    failed: 4,
  });
  f.finish(0);
  await expect(page.locator(".toast")).toContainText(
    "No new songs imported. · 4 files skipped",
  );
  await expect(page.getByText("1 song", { exact: true })).toBeVisible();
  await f.start();
  f.fail();
  await expect(page.getByRole("alert")).toContainText(
    "Music index unavailable",
  );
  await expect(page.locator(".import-status")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Import music", exact: true }),
  ).toBeEnabled();
});

test("cancelling Android file checks preserves the catalog and permits another scan", async ({
  page,
  context,
}) => {
  const f = await importing(page, context);
  await f.start();
  await page
    .locator(".import-status")
    .getByRole("button", { name: "Cancel", exact: true })
    .click();
  await expect.poll(f.cancelled).toBe(true);
  await expect(page.locator(".toast")).toContainText("Import cancelled");
  await expect(page.getByText("1 song", { exact: true })).toBeVisible();
  await f.start();
  await f.native.emit("catalog://progress", { imported: 1, failed: 0 });
  f.finish(1);
  await expect(page.locator(".toast")).toContainText("1 tracks imported");
});
