import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { defaultSound } from "../../src/sound/model";
async function openSettings(page: Page) {
  await page
    .getByRole("button", { name: "Settings", exact: true })
    .first()
    .click();
  return page.getByRole("dialog", { name: "Settings", exact: true });
}
async function storedSound(page: Page) {
  return page.evaluate(
    () =>
      new Promise<any>((resolve) => {
        const request = indexedDB.open("local-music-v1", 1);
        request.onsuccess = () => {
          const db = request.result,
            read = db
              .transaction("settings")
              .objectStore("settings")
              .get("sound-v1");
          read.onsuccess = () => {
            resolve(read.result);
            db.close();
          };
        };
      }),
  );
}
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
    .getByRole("button", { name: "Sound controls", exact: true })
    .click();
  const sound = page.getByRole("dialog", {
    name: "Sound controls",
    exact: true,
  });
  await expect(
    sound.getByRole("slider", { name: "Preamp", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".player-scrim")).toBeHidden();
  await expect(page.getByRole("dialog")).toHaveCount(1);
  await sound.getByRole("button", { name: "Rock", exact: true }).click();
  const preamp = sound.getByRole("slider", { name: "Preamp", exact: true });
  await preamp.focus();
  await page.keyboard.press("ArrowUp");
  const gain = await preamp.inputValue();
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
    queue.getByRole("button", { name: "Sound controls", exact: true }),
  ).toBeFocused();
  expect(
    await queue
      .locator(".player-surface-body")
      .evaluate((node) => node.scrollTop),
  ).toBe(position);
  await queue
    .getByRole("button", { name: "Sound controls", exact: true })
    .click();
  await expect(
    sound.getByRole("slider", { name: "Preamp", exact: true }),
  ).toHaveValue(gain);
  await page.keyboard.press("Escape");
  await expect(queue).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("dialog", { name: "Now playing", exact: true }),
  ).toBeVisible();
});
test("personal banks stay grouped and EN/ES preserve the exact same sound configuration", async ({
  page,
}) => {
  await page.goto("/");
  const config = {
    ...defaultSound(),
    enabled: true,
    preamp: 3.5,
    gains: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
    presetId: "custom",
    personalEnabled: true,
    profileId: "stable-profile",
    profiles: [
      {
        id: "stable-profile",
        name: "Headphones with a long personal music balance name",
        left: [0, 0, 0, 6, 2, 1, 3, 4, 0, 0],
        right: [0, 0, 0, 1, 3, 4, 2, 5, 0, 0],
        complete: Array(12).fill(true),
      },
    ],
  };
  await page.evaluate(
    (config) =>
      new Promise<void>((resolve) => {
        const request = indexedDB.open("local-music-v1", 1);
        request.onsuccess = () => {
          const db = request.result,
            tx = db.transaction("settings", "readwrite");
          tx.objectStore("settings").put(config, "sound-v1");
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
        };
      }),
    config,
  );
  await page.reload();
  let settings = await openSettings(page);
  await settings
    .getByRole("button", { name: "Sound controls", exact: true })
    .click();
  let sound = page.getByRole("dialog", { name: "Sound controls", exact: true });
  await expect(
    sound.getByRole("button", { name: "Disable profile", exact: true }),
  ).toBeVisible();
  const left = sound.getByRole("group", { name: "Left", exact: true }),
    right = sound.getByRole("group", { name: "Right", exact: true });
  await expect(left.getByRole("slider")).toHaveCount(10);
  await expect(right.getByRole("slider")).toHaveCount(10);
  expect((await left.boundingBox())!.y).toBeLessThan(
    (await right.boundingBox())!.y,
  );
  await expect(
    sound.getByRole("slider", { name: "Preamp", exact: true }),
  ).toHaveCount(1);
  await expect(
    sound.getByRole("slider", { name: "Preamp", exact: true }),
  ).toHaveValue("3.5");
  await sound.locator("summary").click();
  await expect(
    sound.getByRole("button", { name: "Rock", exact: true }),
  ).toBeDisabled();
  await page.screenshot({ path: "artifacts/ui-polish-personal-desktop.png" });
  const baseline = await storedSound(page);
  await page.keyboard.press("Escape");
  settings = page.getByRole("dialog", { name: "Settings", exact: true });
  await settings.getByRole("button", { name: "Dark", exact: true }).click();
  await settings.getByRole("button", { name: "Español", exact: true }).click();
  await page
    .getByRole("dialog", { name: "Ajustes", exact: true })
    .getByRole("button", { name: "Controles de sonido", exact: true })
    .click();
  sound = page.getByRole("dialog", {
    name: "Controles de sonido",
    exact: true,
  });
  await expect(
    sound.getByRole("slider", { name: "Preamplificador", exact: true }),
  ).toHaveValue("3.5");
  await expect(
    sound.getByRole("slider", {
      name: "250 Hz ganancia Izquierdo",
      exact: true,
    }),
  ).toHaveValue("6");
  await expect(
    sound.getByRole("slider", { name: "250 Hz ganancia Derecho", exact: true }),
  ).toHaveValue("1");
  expect(await storedSound(page)).toEqual(baseline);
  await sound
    .getByRole("button", { name: "Gestionar perfil", exact: true })
    .click();
  await expect(
    sound.getByRole("menuitem", { name: "Renombrar", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(
    sound.getByRole("button", { name: "Gestionar perfil", exact: true }),
  ).toBeFocused();
  for (const width of [1280, 640, 390]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
    await expect(
      sound
        .locator(".modal-head")
        .getByRole("button", { name: "Cerrar", exact: true }),
    ).toBeInViewport();
  }
  await page.screenshot({
    path: "artifacts/ui-polish-personal-spanish-mobile.png",
  });
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.keyboard.press("Escape");
  await page
    .getByRole("dialog", { name: "Ajustes", exact: true })
    .getByRole("button", { name: "English", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Sound controls", exact: true })
    .click();
  await expect(
    page.getByRole("slider", { name: "250 Hz gain Left", exact: true }),
  ).toHaveValue("6");
  expect(await storedSound(page)).toEqual(baseline);
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
