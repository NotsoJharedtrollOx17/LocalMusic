import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
function wav(seconds = 40) {
  const rate = 16000,
    n = rate * seconds,
    b = Buffer.alloc(44 + n * 2);
  b.write("RIFF", 0);
  b.writeUInt32LE(36 + n * 2, 4);
  b.write("WAVEfmt ", 8);
  b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20);
  b.writeUInt16LE(1, 22);
  b.writeUInt32LE(rate, 24);
  b.writeUInt32LE(rate * 2, 28);
  b.writeUInt16LE(2, 32);
  b.writeUInt16LE(16, 34);
  b.write("data", 36);
  b.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++)
    b.writeInt16LE(Math.sin((i / rate) * 220 * Math.PI * 2) * 2000, 44 + i * 2);
  return b;
}
test("import, actual listening, seek, recap and privacy-safe exports", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Make room for your music." }),
  ).toBeVisible();
  await page.locator("input[type=file]").first().setInputFiles({
    name: "Original test tone.wav",
    mimeType: "audio/wav",
    buffer: wav(),
  });
  await expect(page.getByText("1 tracks imported")).toBeVisible();
  await page
    .getByRole("button", { name: "Play Original test tone", exact: true })
    .click();
  await expect(page.locator(".mini-player")).toBeVisible();
  await page
    .locator(".mini-actions")
    .getByRole("button", { name: "Now playing" })
    .click();
  const dialog = page.getByRole("dialog", { name: "Now playing" });
  await expect(
    dialog.getByRole("button", { name: "Pause", exact: true }),
  ).toBeVisible();
  await page.waitForTimeout(1400);
  await dialog.getByRole("slider").fill("25000");
  await page.waitForTimeout(1400);
  await dialog.getByRole("button", { name: "Pause", exact: true }).click();
  await dialog.getByRole("button", { name: "Close", exact: true }).click();
  await page
    .locator(".sidebar nav")
    .getByRole("button", { name: "Your Year" })
    .click();
  await expect(page.getByText("0 qualified plays")).toBeVisible();
  const jsonWait = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export JSON" }).click();
  const json = await jsonWait;
  const contents = JSON.parse(await readFile((await json.path())!, "utf8"));
  expect(contents.qualifiedPlays).toBe(0);
  expect(contents.minutesListened).toBeLessThan(1);
  expect(JSON.stringify(contents)).not.toMatch(
    /sourceUri|browser-file|T\d\d:|Original test tone.wav/,
  );
  const pngWait = page.waitForEvent("download");
  await page.getByRole("button", { name: "Share card", exact: true }).click();
  const png = await pngWait;
  const image = await readFile((await png.path())!);
  expect(image.readUInt32BE(16)).toBe(1080);
  expect(image.readUInt32BE(20)).toBe(1920);
  await page
    .getByRole("button", { name: "Save snapshot", exact: true })
    .click();
  await expect(page.getByText("Snapshot saved", { exact: true })).toBeVisible();
  await page.screenshot({
    path: "artifacts/recap-desktop.png",
    fullPage: true,
  });
  expect(errors).toEqual([]);
});
test("mobile sample library, filter playlist, editing and Spanish UI", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "Explore with sample audio" }).click();
  await expect(page.getByText("8 songs", { exact: true })).toBeVisible();
  await page.screenshot({
    path: "artifacts/library-mobile.png",
    fullPage: true,
  });
  await page
    .locator(".bottom-nav")
    .getByRole("button", { name: "Playlists" })
    .click();
  await page.getByLabel("Playlist name", { exact: true }).fill("Night mix");
  await page.getByLabel("Exclude artist", { exact: true }).fill("Field Notes");
  await page
    .getByRole("button", { name: "Generate playlist", exact: true })
    .click();
  await expect(page.locator(".generated-result")).toBeVisible();
  await expect(
    page.locator(".generated-result").getByText("Field Notes", { exact: true }),
  ).toHaveCount(0);
  await page
    .locator(".generated-result")
    .getByRole("button", { name: "Save", exact: true })
    .click();
  await expect(page.getByText("Playlist saved", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Play this mix", exact: true })
    .click();
  await expect(page.locator(".mini-player")).toBeVisible();
  await page.locator(".mini-track").click();
  await expect(
    page.getByText("Sample audio · excluded from recap"),
  ).toBeVisible();
  await page.screenshot({ path: "artifacts/player-mobile.png" });
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Pause", exact: true })
    .click();
  await page.getByRole("dialog").getByRole("button", { name: "Close" }).click();
  await page
    .locator(".bottom-nav")
    .getByRole("button", { name: "Your Year" })
    .click();
  await expect(page.getByText("0 qualified plays")).toBeVisible();
  await page
    .locator(".mobile-brand")
    .getByRole("button", { name: "Settings" })
    .click();
  await page.getByLabel("Language", { exact: true }).selectOption("es");
  await expect(page.getByRole("dialog", { name: "Ajustes" })).toBeVisible();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Cerrar" })
    .click();
  await expect(
    page.locator(".bottom-nav").getByRole("button", { name: "Tu año" }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.locator(".bottom-nav").getByRole("button", { name: "Biblioteca" }),
  ).toBeVisible();
  await expect(page.getByText("8 canciones", { exact: true })).toBeVisible();
});

test("30 seconds qualify a play and excluding a session removes its evidence", async ({
  page,
}) => {
  await page.goto("/");
  await page.locator("input[type=file]").first().setInputFiles({
    name: "Qualified tone.wav",
    mimeType: "audio/wav",
    buffer: wav(),
  });
  await expect(page.getByText("1 tracks imported")).toBeVisible();
  await page
    .getByRole("button", { name: "Play Qualified tone", exact: true })
    .click();
  await page.waitForTimeout(31500);
  await page
    .locator(".mini-center")
    .getByRole("button", { name: "Pause", exact: true })
    .click();
  await page
    .locator(".sidebar nav")
    .getByRole("button", { name: "Your Year" })
    .click();
  await expect(page.getByText("1 qualified plays")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Qualified tone", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Save snapshot", exact: true })
    .click();
  await expect(page.getByText("Snapshot saved", { exact: true })).toBeVisible();
  await page
    .locator(".mini-actions")
    .getByRole("button", { name: "Now playing" })
    .click();
  await page.getByLabel("Exclude from recap", { exact: true }).check();
  await page.getByRole("dialog").getByRole("button", { name: "Close" }).click();
  await page
    .locator(".sidebar nav")
    .getByRole("button", { name: "Library" })
    .click();
  await page
    .locator(".sidebar nav")
    .getByRole("button", { name: "Your Year" })
    .click();
  await expect(page.getByText("0 qualified plays")).toBeVisible();
  await page
    .getByRole("button", { name: "Saved snapshots", exact: true })
    .click();
  await page.getByRole("dialog").locator(".snapshot-row").first().click();
  await expect(page.getByText("1 qualified plays")).toBeVisible();
  await page.getByRole("button", { name: "Export JSON" }).click();
  await expect(page.getByRole("alert")).toContainText(
    "History privacy changed",
  );
  await page.reload();
  await page
    .locator(".sidebar nav")
    .getByRole("button", { name: "Your Year" })
    .click();
  await expect(page.getByText("0 qualified plays")).toBeVisible();
});

test("catalog pagination, favorites and manual picker cover unloaded songs", async ({
  page,
}) => {
  await page.goto("/");
  const files = Array.from({ length: 125 }, (_, i) => {
    const buffer = wav(1);
    buffer.writeInt16LE(i, 44);
    return {
      name: "Fixture " + String(i).padStart(3, "0") + ".wav",
      mimeType: "audio/wav",
      buffer,
    };
  });
  await page.locator("input[type=file]").first().setInputFiles(files);
  await expect(page.getByText("125 songs", { exact: true })).toBeVisible({
    timeout: 20000,
  });
  expect(await page.locator(".track-row").count()).toBeLessThan(40);
  await page.getByRole("button", { name: "Search your library" }).click();
  await page.getByRole("searchbox").fill("Fixture 120");
  await expect(
    page.getByRole("button", { name: "Play Fixture 120", exact: true }),
  ).toBeVisible();
  await page
    .locator(".track-row")
    .getByRole("button", { name: "Favorite", exact: true })
    .click();
  await page.getByRole("searchbox").fill("");
  await page.getByRole("button", { name: "Favorites", exact: true }).click();
  await expect(page.getByText("1 songs", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Play Fixture 120", exact: true }),
  ).toBeVisible();
  await page
    .locator(".sidebar nav")
    .getByRole("button", { name: "Playlists", exact: true })
    .click();
  await page.getByRole("button", { name: "New playlist", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByLabel("Playlist name", { exact: true })
    .fill("Manual selection");
  await dialog
    .getByRole("textbox", { name: "Search your library" })
    .fill("Fixture 124");
  await expect(dialog.getByRole("checkbox")).toHaveCount(1);
  await dialog.getByRole("checkbox").check();
  await dialog.getByRole("button", { name: "Save", exact: true }).click();
  await expect(
    page.getByText("Manual selection", { exact: true }),
  ).toBeVisible();
});
