import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { readFile } from "node:fs/promises";
import { taggedWav } from "./fixtures";
import { holdNextTrackRead, release } from "./catalog-gate";

async function samples(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Explore with sample audio" }).click();
  await expect(page.getByText("8 songs", { exact: true })).toBeVisible();
}
async function swipe(
  page: Page,
  x: number,
  y: number,
  endX: number,
  endY: number,
) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x, y }],
  });
  for (let i = 1; i <= 8; i++)
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [
        { x: x + ((endX - x) * i) / 8, y: y + ((endY - y) * i) / 8 },
      ],
    });
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await cdp.detach();
}

test("grouped search, keyboard tabs, artist albums and focus return", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .locator("input[type=file]")
    .first()
    .setInputFiles(
      Array.from({ length: 35 }, (_, i) => ({
        name: `Fixture ${i}.wav`,
        mimeType: "audio/wav",
        buffer: taggedWav(`Fixture ${String(i).padStart(2, "0")}`, i, 1),
      })),
    );
  await expect(page.getByText("35 songs", { exact: true })).toBeVisible();
  const albums = page.getByRole("tab", { name: "Albums", exact: true });
  await page.getByRole("tab", { name: "Songs", exact: true }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(albums).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(albums).toHaveAttribute("aria-selected", "true");
  await expect(page.locator(".album-card")).toHaveCount(1);
  const opener = page.getByRole("button", {
    name: "Search your library",
    exact: true,
  });
  await opener.click();
  const search = page.getByRole("search");
  await expect(search.getByRole("searchbox")).toBeFocused();
  await search.getByRole("searchbox").fill("Fixture");
  await expect(search.locator(".track-row")).toHaveCount(30);
  await search.getByRole("button", { name: "Load more", exact: true }).click();
  await expect(search.locator(".track-row")).toHaveCount(35);
  await expect(
    search.getByRole("heading", { name: "Albums", exact: true }),
  ).toBeVisible();
  await expect(
    search.getByRole("heading", { name: "Artists", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(search).toHaveCount(0);
  await expect(opener).toBeFocused();
  await expect(albums).toHaveAttribute("aria-selected", "true");
  await page.getByRole("tab", { name: "Artists", exact: true }).click();
  await page.locator(".album-card").click();
  await expect(
    page.getByRole("heading", { name: "Fixture Artist", exact: true }),
  ).toBeVisible();
  await page
    .locator(".artist-view")
    .getByRole("tab", { name: "Albums" })
    .click();
  await expect(page.locator(".album-card")).toHaveCount(1);
  await page.locator(".album-card").click();
  await expect(
    page.getByRole("heading", { name: "Fixture Album", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("heading", { name: "Fixture Artist", exact: true }),
  ).toBeVisible();
  await expect(
    page.locator(".artist-view").getByRole("tab", { name: "Albums" }),
  ).toHaveAttribute("aria-selected", "true");
  await expect(page.locator(".album-card")).toHaveCount(1);
  await page.screenshot({ path: "artifacts/phase-two-artist-desktop.png" });
});

test("search ignores late reads and keeps playback available", async ({
  page,
}) => {
  await samples(page);
  await page
    .getByRole("button", { name: "Play A quieter orbit", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Search your library", exact: true })
    .click();
  const search = page.getByRole("search"),
    box = search.getByRole("searchbox");
  await holdNextTrackRead(page);
  await box.fill("Signal");
  await expect(search.getByRole("status")).toBeVisible();
  // Let the debounced read enter the held IndexedDB request before replacing it.
  await page.waitForTimeout(220);
  await box.fill("rain");
  await expect(search.locator(".track-copy strong")).toHaveText([
    "Blue after rain",
  ]);
  await release(page);
  await page.waitForTimeout(250);
  await expect(search.locator(".track-copy strong")).toHaveText([
    "Blue after rain",
  ]);
  await expect(page.locator(".mini-player")).toBeVisible();
  await page
    .locator(".mini-center")
    .getByRole("button", { name: "Pause", exact: true })
    .click();
  await expect(
    page
      .locator(".mini-center")
      .getByRole("button", { name: "Play", exact: true }),
  ).toBeVisible();
  expect(
    (await new AxeBuilder({ page }).include(".search-surface").analyze())
      .violations,
  ).toEqual([]);
  await page.screenshot({ path: "artifacts/phase-two-search-desktop.png" });
});

test("mobile swipe tabs and player keep transport anchored, Back and reduced motion", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: "dark" });
  await samples(page);
  await page.evaluate(() => window.scrollTo(0, 160));
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(160);
  await swipe(page, 320, 450, 75, 450);
  await expect(
    page.getByRole("tab", { name: "Albums", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await expect(page.locator(".mini-player")).toHaveCount(0);
  await page.getByRole("tab", { name: "Songs", exact: true }).click();
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(160);
  await page
    .getByRole("button", { name: "Play A quieter orbit", exact: true })
    .click();
  const mini = page.locator(".mini-track"),
    box = (await mini.boundingBox())!;
  await swipe(page, box.x + 80, box.y + 35, box.x + 80, box.y - 100);
  const player = page.getByRole("dialog", { name: "Now playing", exact: true });
  await expect(player).toBeVisible();
  await player.evaluate((el) => el.setAttribute("data-kept", "yes"));
  await player
    .getByRole("button", { name: "Track actions", exact: true })
    .click();
  await page
    .getByRole("menuitem", { name: "Track details", exact: true })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Track details", exact: true }),
  ).toBeVisible();
  await page.evaluate(() => window.__musicBack?.());
  await expect(
    page.getByRole("dialog", { name: "Track details", exact: true }),
  ).toHaveCount(0);
  await expect(player).toHaveAttribute("data-kept", "yes");
  await player.evaluate((el) =>
    Promise.all(
      el
        .getAnimations({ subtree: true })
        .map((a) => a.finished.catch(() => {})),
    ),
  );
  const footerY = (await player
    .locator(".player-surface-footer")
    .boundingBox())!.y;
  await player.getByRole("button", { name: "Queue", exact: true }).click();
  const queue = page.getByRole("dialog", { name: "Queue", exact: true });
  await expect(queue).toBeVisible();
  expect((await queue.locator(".player-surface-footer").boundingBox())!.y).toBe(
    footerY,
  );
  await page.evaluate(() => window.__musicBack?.());
  await expect(player).toBeVisible();
  expect(
    (await new AxeBuilder({ page }).include(".player-surface").analyze())
      .violations,
  ).toEqual([]);
  await page.screenshot({ path: "artifacts/phase-two-player-mobile-dark.png" });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await player.getByRole("button", { name: "Close", exact: true }).click();
  await expect(player).toHaveCount(0);
  await expect(mini).toBeFocused();
  await mini.press("Enter");
  await expect(player).toBeVisible();
  expect(
    await player.evaluate((el) => el.getAnimations({ subtree: true }).length),
  ).toBe(0);
  const head = (await player.locator(".player-surface-head").boundingBox())!;
  await swipe(
    page,
    head.x + head.width / 2,
    head.y + 24,
    head.x + head.width / 2,
    head.y + 180,
  );
  await expect(player).toHaveCount(0);
  await expect(page.locator(".mini-player")).toBeVisible();
});

test("selection, persistent removal, Undo, original audio copy and reimport", async ({
  page,
}) => {
  await page.goto("/");
  const buffer = taggedWav(
    "A very long original song title for selection and copies",
    7,
    40,
  );
  const file = { name: "Original.wav", mimeType: "audio/wav", buffer };
  await page.locator("input[type=file]").first().setInputFiles(file);
  await expect(page.getByText("1 song", { exact: true })).toBeVisible();
  await page
    .locator(".track-row")
    .getByRole("button", { name: "Track details", exact: true })
    .click();
  const menu = page.getByRole("menu");
  const downloading = page.waitForEvent("download");
  await menu
    .getByRole("menuitem", { name: /Share audio|Save audio copies/ })
    .click();
  await expect(page.locator(".toast")).toHaveText("Audio download started");
  expect(await readFile((await (await downloading).path())!)).toEqual(buffer);
  await page
    .getByRole("button", { name: "Library actions", exact: true })
    .click();
  await page
    .getByRole("menuitem", { name: "Select songs", exact: true })
    .click();
  await page.locator(".selection-check").click();
  await expect(page.locator(".selection-toolbar")).toContainText("1 selected");
  await page
    .locator(".selection-toolbar")
    .getByRole("button", { name: "Remove from Library", exact: true })
    .click();
  const confirm = page.getByRole("dialog", {
    name: "Remove from Library",
    exact: true,
  });
  await expect(confirm).toContainText(
    "Original audio files and listening history stay",
  );
  await confirm
    .getByRole("button", { name: "Remove from Library", exact: true })
    .click();
  await expect(page.locator(".track-row")).toHaveCount(0);
  await page
    .locator(".undo-banner")
    .getByRole("button", { name: "Undo", exact: true })
    .click();
  await expect(page.locator(".track-row")).toHaveCount(1);
  await page
    .locator(".track-row")
    .getByRole("button", { name: "Track details", exact: true })
    .click();
  await menu
    .getByRole("menuitem", { name: "Remove from Library", exact: true })
    .click();
  await confirm
    .getByRole("button", { name: "Remove from Library", exact: true })
    .click();
  await expect(confirm).toHaveCount(0);
  await expect(page.locator(".undo-banner")).toBeVisible();
  await page.reload();
  await expect(page.locator(".track-row")).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Make room for your music." }),
  ).toBeVisible();
  await page.locator("input[type=file]").first().setInputFiles(file);
  await expect(page.locator(".track-row")).toHaveCount(1);
});

test("mobile long press, sharing cancellation and editable sound controls", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await samples(page);
  const hit = page.locator(".track-hit").first();
  await hit.dispatchEvent("pointerdown", {
    pointerType: "touch",
    clientX: 90,
    clientY: 430,
  });
  await expect(page.locator(".selection-toolbar")).toContainText("1 selected");
  await hit.dispatchEvent("pointerup", { pointerType: "touch" });
  await hit.dispatchEvent("click");
  await expect(page.locator(".mini-player")).toHaveCount(0);
  await page.evaluate(() => {
    Object.defineProperty(navigator, "canShare", {
      configurable: true,
      value: () => true,
    });
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: () => Promise.reject(new DOMException("Canceled", "AbortError")),
    });
  });
  await page
    .locator(".selection-toolbar")
    .getByRole("button", { name: /Share audio|Save audio copies/ })
    .click();
  await expect(page.locator(".toast")).not.toContainText(
    "Sharing chooser opened",
  );
  await page.keyboard.press("Escape");
  await expect(page.locator(".selection-toolbar")).toHaveCount(0);
  await page
    .locator(".heading-actions")
    .getByRole("button", { name: "Settings", exact: true })
    .click();
  await page
    .getByRole("dialog", { name: "Settings", exact: true })
    .getByRole("button", { name: "Sound controls", exact: true })
    .click();
  const sound = page.getByRole("dialog", {
    name: "Sound controls",
    exact: true,
  });
  await expect(sound).not.toContainText("Audio effects are not available");
  await expect(
    sound.getByRole("button", { name: "Normal", exact: true }),
  ).toBeVisible();
  await expect(sound.getByRole("slider")).toHaveCount(9);
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("dialog", { name: "Settings", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await page
    .getByRole("button", { name: "Library actions", exact: true })
    .click();
  await page
    .getByRole("menuitem", { name: "Select songs", exact: true })
    .click();
  const selection = page.locator(".selection-toolbar");
  await selection
    .getByRole("button", { name: "Select visible songs", exact: true })
    .click();
  await selection
    .getByRole("button", { name: "Remove from Library", exact: true })
    .click();
  const remove = page.getByRole("dialog", {
    name: "Remove from Library",
    exact: true,
  });
  await remove
    .getByRole("button", { name: "Remove from Library", exact: true })
    .click();
  await expect(remove).toHaveCount(0);
  await page.reload();
  await page
    .getByRole("button", { name: "Explore with sample audio", exact: true })
    .click();
  await expect(page.getByText("8 songs", { exact: true })).toBeVisible();
});

test("hidden playlist entries keep their membership and visible editing order", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .locator("input[type=file]")
    .first()
    .setInputFiles(
      [0, 1, 2].map((i) => ({
        name: `Fixture ${i}.wav`,
        mimeType: "audio/wav",
        buffer: taggedWav(`Fixture ${i}`, i, 40),
      })),
    );
  await expect(page.getByText("3 songs", { exact: true })).toBeVisible();
  await page.getByRole("tab", { name: "Playlists", exact: true }).click();
  await page.getByRole("button", { name: "New playlist", exact: true }).click();
  const manual = page.getByRole("dialog", {
    name: "New playlist",
    exact: true,
  });
  await manual.getByLabel("Playlist name", { exact: true }).fill("Fixture mix");
  await expect(manual.getByRole("checkbox")).toHaveCount(3);
  for (const checkbox of await manual.getByRole("checkbox").all())
    await checkbox.check();
  await manual.getByRole("button", { name: "Save", exact: true }).click();
  await page
    .locator(".playlist-tile")
    .filter({ hasText: "Fixture mix" })
    .click();
  await page
    .locator(".track-row")
    .first()
    .getByRole("button", { name: "Track details", exact: true })
    .click();
  await page
    .getByRole("menuitem", { name: "Remove from Library", exact: true })
    .click();
  await page
    .getByRole("dialog", { name: "Remove from Library", exact: true })
    .getByRole("button", { name: "Remove from Library", exact: true })
    .click();
  await expect(page.locator(".track-copy strong")).toHaveText([
    "Fixture 1",
    "Fixture 2",
  ]);
  await page
    .getByRole("button", { name: "Play this mix", exact: true })
    .click();
  await expect(page.locator(".mini-track strong")).toHaveText("Fixture 1");
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await page
    .locator(".track-row")
    .first()
    .getByRole("button", { name: "Move down", exact: true })
    .click();
  await expect(page.locator(".track-copy strong")).toHaveText([
    "Fixture 2",
    "Fixture 1",
  ]);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page
    .locator(".undo-banner")
    .getByRole("button", { name: "Undo", exact: true })
    .click();
  await expect(page.locator(".track-copy strong")).toHaveText([
    "Fixture 0",
    "Fixture 2",
    "Fixture 1",
  ]);
  await page
    .getByRole("button", { name: "Search your library", exact: true })
    .click();
  const search = page.getByRole("search");
  await search.getByRole("searchbox").fill("Fixture mix");
  await expect(
    search.getByRole("heading", { name: "Playlists", exact: true }),
  ).toBeVisible();
  await search
    .getByRole("button", { name: "Fixture mix", exact: true })
    .click();
  await expect(search).toHaveCount(0);
  await expect(page.locator(".track-copy strong")).toHaveText([
    "Fixture 0",
    "Fixture 2",
    "Fixture 1",
  ]);
});
