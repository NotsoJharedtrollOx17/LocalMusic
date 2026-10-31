/** Actual WebView2 multi-window smoke test. Launch only an isolated probe profile.
 * node scripts/verify-detached-windows.mjs PORT PID OUTPUT_DIRECTORY
 */
import { chromium, expect as assertion } from "@playwright/test";
import { writeFile, mkdir } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
const [port = "9331", pid, output = "artifacts/detached-windows"] =
  process.argv.slice(2);
if (!pid)
  throw Error(
    "Pass the isolated app PID; never run against a personal library",
  );
await mkdir(output, { recursive: true });
const expect = assertion.configure({ timeout: 20000 }),
  run = promisify(execFile);
const browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
const pages = () => browser.contexts().flatMap((c) => c.pages());
const main = pages().find((p) => !p.url().includes("companion="));
const invoke = (page, command, args = {}) =>
  page.evaluate(
    ({ command, args }) => window.__TAURI_INTERNALS__.invoke(command, args),
    { command, args },
  );
const find = async (view) => {
  await expect
    .poll(() => pages().some((p) => p.url().includes(`companion=${view}`)))
    .toBe(true);
  const p = pages().find((p) => p.url().includes(`companion=${view}`));
  p.setDefaultTimeout(20000);
  return p;
};
const os = async (mode, needle = "", ...args) =>
  JSON.parse(
    (
      await run("python", [
        "tests/native/window-os.py",
        pid,
        mode,
        needle,
        ...args.map(String),
      ])
    ).stdout,
  );
const evidence = {};
try {
  await main.waitForFunction(() => window.__TAURI_INTERNALS__?.invoke);
  const id = await invoke(main, "plugin:app|identifier");
  expect(id).toBe("app.localmusic.detachedprobe20261031");
  await expect(
    main.getByRole("tab", { name: "Songs", exact: true }),
  ).toBeVisible();
  const initial = await invoke(main, "playback_snapshot");
  expect(initial.trackId).toBe("native-0");
  expect(initial.playing).toBe(false);
  evidence.audioOutput =
    "Unavailable in this execution environment; paused synthetic queue only";
  await expect(main.locator(".mini-track")).toContainText("Native song 00000");
  await main.locator(".mini-track").click();
  await main
    .getByRole("button", { name: "Open in separate window", exact: true })
    .click();
  const player = await find("player");
  await expect(player.locator(".standalone-player")).toBeVisible();
  await expect(main.locator(".player-scrim:visible")).toHaveCount(0);
  await expect(player.locator(".library-page,.mini-player")).toHaveCount(0);
  await player
    .getByRole("button", { name: "Always on top", exact: true })
    .click();
  await expect
    .poll(
      async () =>
        (await os("list")).find((w) => w.title.includes("Now playing"))
          ?.topmost,
    )
    .toBe(true);
  await player
    .getByRole("button", { name: "Always on top", exact: true })
    .click();
  await player.getByRole("button", { name: "Queue", exact: true }).click();
  await expect(
    player.getByRole("dialog", { name: "Queue", exact: true }),
  ).toBeVisible();
  await player.keyboard.press("Escape");
  await expect(
    player.getByRole("dialog", { name: "Now playing", exact: true }),
  ).toBeVisible();
  const favoriteButton = player.getByRole("button", {
    name: "Favorite",
    exact: true,
  });
  const wasFavorite =
    (await favoriteButton.getAttribute("aria-pressed")) === "true";
  await favoriteButton.click();
  const libraryFavorite = main
    .locator('[data-track-id="native-0"]')
    .getByRole("button", { name: "Favorite", exact: true });
  if (wasFavorite)
    await expect(libraryFavorite).not.toHaveAttribute("aria-pressed", "true");
  else await expect(libraryFavorite).toHaveAttribute("aria-pressed", "true");
  evidence.favoriteSynchronized = true;
  await invoke(main, "seek", { ms: 30000 });
  await expect(player.getByRole("slider")).toHaveValue("30000");
  await invoke(player, "seek", { ms: 12000 });
  await expect(main.locator(".mini-player").getByRole("slider")).toHaveValue(
    "12000",
  );
  await main.locator(".mini-track").click();
  expect(
    pages().filter((p) => p.url().includes("companion=player")).length,
  ).toBe(1);
  await player
    .getByRole("button", { name: "Player options", exact: true })
    .click();
  await player
    .getByRole("menuitem", { name: "Visualizer", exact: true })
    .click();
  await expect(
    main.getByRole("dialog", { name: "Visualizer", exact: true }),
  ).toBeVisible();
  await main
    .getByRole("button", { name: "Open in separate window", exact: true })
    .click();
  const visualizer = await find("visualizer");
  await expect(visualizer.locator("canvas")).toBeVisible();
  await expect(main.locator(".visualizer-view")).toHaveCount(0);
  expect((await invoke(main, "desktop_state")).windows.length).toBe(2);
  await expect(invoke(main, "start_visualizer")).rejects.toBeTruthy();
  await os("minimize", "Your Recap");
  await expect(visualizer.locator("canvas")).toBeVisible();
  await os("restore", "Your Recap");
  await player.screenshot({ path: `${output}/player-en.png` });
  await visualizer.screenshot({ path: `${output}/visualizer-en.png` });
  await invoke(player, "patch_settings", { patch: { language: "es" } });
  await invoke(visualizer, "patch_settings", {
    patch: { visualizerMode: "geometry", theme: "dark" },
  });
  await expect(
    player.getByRole("dialog", { name: "Reproduciendo", exact: true }),
  ).toBeVisible();
  await expect(
    main.getByRole("tab", { name: "Canciones", exact: true }),
  ).toBeVisible();
  await expect(
    visualizer.getByRole("button", { name: "Geometr\u00eda", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  expect(
    (
      await invoke(main, "get_settings", {
        defaultTimeZone: "America/Los_Angeles",
      })
    ).language,
  ).toBe("es");
  await os("resize", "Reproduciendo", 440, 600);
  await os("resize", "Visualizador", 440, 600);
  await player.screenshot({ path: `${output}/player-es-dark-short.png` });
  await visualizer.screenshot({
    path: `${output}/visualizer-es-dark-short.png`,
  });
  for (const p of [player, visualizer])
    expect(
      await p.evaluate(() => document.documentElement.scrollWidth - innerWidth),
    ).toBeLessThanOrEqual(1);
  evidence.windows = await os("list");
  await os("close", "Visualizador");
  await expect
    .poll(async () => (await invoke(main, "desktop_state")).windows.length)
    .toBe(1);
  await expect(main.locator(".visualizer-view")).toBeVisible();
  await main.keyboard.press("Escape");
  await player.getByRole("button", { name: "Cola", exact: true }).click();
  await player
    .getByRole("button", { name: "Volver a la ventana principal", exact: true })
    .click();
  await expect(
    main.getByRole("dialog", { name: "Cola", exact: true }),
  ).toBeVisible();
  evidence.finalPlayback = await invoke(main, "playback_snapshot");
  expect(evidence.finalPlayback.playing).toBe(false);
  expect(evidence.finalPlayback.queue).toEqual([
    "native-0",
    "native-1",
    "native-2",
  ]);
  evidence.identity = id;
  evidence.passed = true;
  await writeFile(
    `${output}/native-evidence.json`,
    JSON.stringify(evidence, null, 2),
  );
  console.log(JSON.stringify(evidence));
} finally {
  await browser.close();
}
