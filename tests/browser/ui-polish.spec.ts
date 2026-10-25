import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import {
  openSettings,
  openEqualizer,
  equalizerDialog,
  closeEqualizer,
} from "./navigationHelpers";
test("queue yields the entire modal surface to sound and restores scroll and focus", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Explore with sample audio" }).click();
  await page
    .locator(".track-row")
    .first()
    .getByRole("button", { name: /^Play / })
    .click();
  await page
    .locator(".mini-player")
    .getByRole("button", { name: "Queue", exact: true })
    .click();
  const queue = page.getByRole("dialog", { name: "Queue", exact: true });
  await queue.locator(".player-surface-body").evaluate((node) => {
    node.scrollTop = 180;
  });
  const position = await queue
    .locator(".player-surface-body")
    .evaluate((node) => node.scrollTop);
  await queue
    .getByRole("button", { name: "Player options", exact: true })
    .click();
  await page.getByRole("menuitem", { name: "Equalizer", exact: true }).click();
  const sound = await equalizerDialog(page);
  await expect(
    sound.getByRole("slider", { name: "1000 Hz gain", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".player-scrim")).toBeHidden();
  await expect(page.getByRole("dialog")).toHaveCount(1);
  await sound.getByRole("button", { name: "Rock", exact: true }).click();
  const band = sound.getByRole("slider", { name: "1000 Hz gain", exact: true });
  await band.focus();
  await page.keyboard.press("ArrowUp");
  const gain = await band.inputValue();
  await sound.locator(".modal-body").evaluate((node) => {
    node.scrollTop = node.scrollHeight;
  });
  await expect(
    sound
      .locator(".modal-head")
      .getByRole("button", { name: "Close", exact: true }),
  ).toBeInViewport();
  await sound
    .locator(".modal-head")
    .getByRole("button", { name: "Close", exact: true })
    .click();
  await expect(queue).toBeVisible();
  await expect(
    queue.getByRole("button", { name: "Player options", exact: true }),
  ).toBeFocused();
  expect(
    await queue
      .locator(".player-surface-body")
      .evaluate((node) => node.scrollTop),
  ).toBe(position);
  await queue
    .getByRole("button", { name: "Player options", exact: true })
    .click();
  await page.getByRole("menuitem", { name: "Equalizer", exact: true }).click();
  await equalizerDialog(page);
  await expect(
    sound.getByRole("slider", { name: "1000 Hz gain", exact: true }),
  ).toHaveValue(gain);
  await page.keyboard.press("Escape");
  await expect(queue).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("dialog", { name: "Now playing", exact: true }),
  ).toBeVisible();
});
test("search starts with guidance and playlist Save stays reachable while its list scrolls", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Explore with sample audio" }).click();
  await page
    .getByRole("button", { name: "Search your library", exact: true })
    .click();
  const search = page.getByRole("search");
  await expect(
    search.getByRole("button", { name: "Close", exact: true }),
  ).toHaveCount(1);
  await expect(search.locator(".search-prompt")).toBeVisible();
  await search.getByRole("searchbox").fill("no-music-with-this-name");
  await expect(search).toContainText("No matching music");
  await page.keyboard.press("Escape");
  await page.getByRole("tab", { name: "Playlists", exact: true }).click();
  await page.getByRole("button", { name: "New playlist", exact: true }).click();
  const playlist = page.getByRole("dialog", {
    name: "New playlist",
    exact: true,
  });
  await playlist
    .getByLabel("Playlist name", { exact: true })
    .fill("My listening list");
  await playlist.getByRole("checkbox").first().check();
  await playlist.locator(".track-picker").evaluate((node) => {
    node.scrollTop = node.scrollHeight;
  });
  await expect(
    playlist.getByRole("button", { name: "Save", exact: true }),
  ).toBeInViewport();
  await expect(
    playlist
      .locator(".modal-head")
      .getByRole("button", { name: "Close", exact: true }),
  ).toBeInViewport();
  await page.screenshot({ path: "artifacts/ui-polish-playlist-desktop.png" });
  await playlist.getByRole("button", { name: "Save", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "My listening list", exact: true }),
  ).toBeVisible();
});

test("Library orders recap last, groups actions below tabs and keeps EQ actions together", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Explore with sample audio" }).click();
  const tabs = page.locator(".section-tabs");
  await expect(tabs.getByRole("tab")).toHaveText([
    "Songs",
    "Albums",
    "Artists",
    "Playlists",
    "Your Year",
  ]);
  const importButton = page
    .locator(".library-toolbar")
    .getByRole("button", { name: "Import music", exact: true });
  await expect(importButton).toBeVisible();
  await expect(
    page
      .locator(".heading-actions")
      .getByRole("button", { name: "Import music", exact: true }),
  ).toHaveCount(0);
  const tabBounds = (await tabs.boundingBox())!;
  expect((await importButton.boundingBox())!.y).toBeGreaterThanOrEqual(
    tabBounds.y + tabBounds.height,
  );
  await page.getByRole("tab", { name: "Songs", exact: true }).focus();
  await page.keyboard.press("End");
  await expect(
    page.getByRole("tab", { name: "Your Year", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("tab", { name: "Your Year", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await expect(page.getByText("0 qualified plays")).toBeVisible();
  await expect(page.locator(".year-page > .page-heading .eyebrow")).toHaveCount(
    0,
  );
  await expect(page.locator(".sidebar")).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("tab", { name: "Songs", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await page
    .getByRole("button", { name: "Library actions", exact: true })
    .click();
  await expect(
    page.getByRole("menuitem", { name: "Edit", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("menuitem")).toHaveText([
    "Edit",
    "Equalizer",
    "Settings",
  ]);
  await expect(page.getByRole("menuitemradio")).toHaveCount(0);
  await page.keyboard.press("Escape");
  const sound = await openEqualizer(page);
  await expect(sound.locator(".sound-preamp-control button")).toHaveCount(0);
  await expect(sound.locator(".equalizer-bands")).toHaveCSS(
    "border-bottom-width",
    "0px",
  );
  await expect(
    sound.locator(".sound-fieldset + .sound-actions").getByRole("button"),
  ).toHaveCount(0);
  await page.screenshot({ path: "artifacts/library-eq-ordering-desktop.png" });
});

test("player artwork remains square and fits above transport when height shrinks", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Explore with sample audio" }).click();
  await page
    .locator(".track-row")
    .first()
    .getByRole("button", { name: /^Play / })
    .click();
  await page.locator(".mini-track").click();
  const player = page.getByRole("dialog", { name: "Now playing", exact: true });
  let previousSize = Infinity;
  for (const height of [1000, 750, 600]) {
    await page.setViewportSize({ width: 1000, height });
    await expect
      .poll(async () =>
        player
          .locator(".player-cover")
          .evaluate((node) =>
            Math.abs(
              node.getBoundingClientRect().width -
                node.getBoundingClientRect().height,
            ),
          ),
      )
      .toBeLessThan(1);
    await expect
      .poll(async () =>
        player
          .locator(".player-surface-body")
          .evaluate((node) => node.scrollHeight - node.clientHeight),
      )
      .toBeLessThanOrEqual(2);
    const bounds = (await player.locator(".player-cover").boundingBox())!;
    expect(bounds.width).toBeLessThanOrEqual(previousSize);
    previousSize = bounds.width;
    await expect(
      player
        .locator(".player-surface-footer")
        .getByRole("button", { name: "Pause", exact: true }),
    ).toBeInViewport();
    await page.screenshot({ path: `artifacts/player-height-${height}.png` });
  }
});
