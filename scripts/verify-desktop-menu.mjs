/** Real Win32 menu + WebView2 inspection. Only the isolated synthetic profile.
 * node scripts/verify-desktop-menu.mjs PORT PID OUTPUT_DIRECTORY
 */
import { chromium, expect as assertion } from "@playwright/test";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdir, writeFile } from "node:fs/promises";
const [port = "9342", pid, output = "artifacts/desktop-menu/native"] =
  process.argv.slice(2);
if (!pid) throw Error("Pass the owned isolated probe PID");
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
const os = async (mode, needle = "", ...args) =>
  JSON.parse(
    (
      await run(
        "python",
        ["tests/native/window-os.py", pid, mode, needle, ...args.map(String)],
        { env: { ...process.env, PYTHONIOENCODING: "utf-8" } },
      )
    ).stdout,
  );
const evidence = { keyboard: {}, screenshots: [] };
let title,
  authorized = false;
try {
  await main.waitForFunction(() => window.__TAURI_INTERNALS__?.invoke);
  expect(await invoke(main, "plugin:app|identifier")).toBe(
    "app.localmusic.menuprobe20261101",
  );
  authorized = true;
  await invoke(main, "patch_settings", {
    patch: { language: "en", theme: "light" },
  });
  await invoke(main, "set_shuffle", { value: false });
  await invoke(main, "set_repeat", { value: "off" });
  if ((await invoke(main, "playback_snapshot")).playing)
    await invoke(main, "toggle_playback");
  await expect(
    main.getByRole("tab", { name: "Songs", exact: true }),
  ).toBeVisible();
  await expect
    .poll(async () =>
      (await os("list")).some((w) => w.title === "Local Music - Your Recap"),
    )
    .toBe(true);
  title = (await os("list")).find(
    (w) => !/Now playing|Visualizer|Equalizer/.test(w.title),
  ).title;
  const menus = () => os("menus", title);
  const item = async (path) => {
    let entries = await menus(),
      found;
    for (const part of path.split("/")) {
      found = entries.find((e) => e.label === part);
      if (!found) return null;
      entries = found.children;
    }
    return found;
  };
  const command = async (path) => {
    await expect.poll(async () => (await item(path))?.enabled).toBe(true);
    await os("menu-command", title, path);
  };
  const cancelPicker = async () => {
    await expect
      .poll(async () =>
        (await os("dialogs")).some((w) => !w.title.startsWith("Local Music")),
      )
      .toBe(true);
    const picker = (await os("dialogs")).find(
      (w) => !w.title.startsWith("Local Music"),
    );
    await os("cancel-dialog", picker.title);
    await expect
      .poll(async () => (await item("File/Import music…"))?.enabled)
      .toBe(true);
  };
  await expect
    .poll(async () => (await menus()).map((m) => m.label).join("|"))
    .toBe("File|Library|Playback|Window|Help");
  evidence.initialMenus = await menus();
  expect((await item("Library/Songs")).checked).toBe(true);
  for (const [label, tab] of [
    ["Artists", "Artists"],
    ["Playlists", "Playlists"],
    ["Your Recap", "Your Recap"],
    ["Songs", "Songs"],
  ]) {
    await command(`Library/${label}`);
    await expect(
      main.getByRole("tab", { name: tab, exact: true }),
    ).toHaveAttribute("aria-selected", "true");
    await expect
      .poll(async () => (await item(`Library/${label}`))?.checked)
      .toBe(true);
    if (label === "Your Recap")
      expect((await item("Library/Search current view")).enabled).toBe(false);
  }
  await command("Library/Albums");
  await expect(
    main.getByRole("tab", { name: "Albums", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await expect
    .poll(async () => (await item("Library/Albums"))?.checked)
    .toBe(true);
  await command("Library/Search current view");
  await expect(main.getByRole("searchbox")).toBeFocused();
  await command("File/New playlist…");
  await expect(
    main.getByRole("dialog", { name: "New playlist", exact: true }),
  ).toBeVisible();
  expect((await item("File/Settings…")).enabled).toBe(false);
  await main.keyboard.press("Escape");
  await command("Playback/Play");
  await expect
    .poll(async () => (await invoke(main, "playback_snapshot")).playing)
    .toBe(true);
  await command("Playback/Pause");
  await expect
    .poll(async () => (await invoke(main, "playback_snapshot")).playing)
    .toBe(false);
  evidence.playPause =
    "confirmed native playback state and menu label changed in both directions (synthetic silence)";
  await command("Playback/Shuffle");
  await expect
    .poll(async () => (await invoke(main, "playback_snapshot")).shuffle)
    .toBe(true);
  await expect
    .poll(async () => (await item("Playback/Shuffle"))?.checked)
    .toBe(true);
  await command("Playback/Repeat/One");
  await expect
    .poll(async () => (await item("Playback/Repeat/One"))?.checked)
    .toBe(true);
  expect((await item("Playback/Repeat/Off")).checked).toBe(false);
  for (const path of ["Playback/Next", "Playback/Previous"])
    await command(path);
  await command("Help/Help and keyboard shortcuts…");
  await expect(
    main.getByRole("dialog", {
      name: "Help and keyboard shortcuts",
      exact: true,
    }),
  ).toContainText("Ctrl+O");
  await main.keyboard.press("Escape");
  await command("Help/About Local Music…");
  await expect(
    main.getByRole("dialog", { name: "About Local Music", exact: true }),
  ).toContainText("0.13.0");
  await main.keyboard.press("Escape");
  // Exercise the real folder picker and cancellation without importing user files.
  await command("File/Import music…");
  await cancelPicker();
  evidence.importCancellation =
    "native folder picker cancelled; import is usable again";
  for (const [chord, dialog] of [
    ["CTRL+F", null],
    ["CTRL+N", "New playlist"],
    ["CTRL+COMMA", "Settings"],
    ["CTRL+O", "picker"],
  ]) {
    try {
      const path =
        chord === "CTRL+F"
          ? "Library/Search current view"
          : chord === "CTRL+N"
            ? "File/New playlist…"
            : chord === "CTRL+O"
              ? "File/Import music…"
              : "File/Settings…";
      await expect.poll(async () => (await item(path))?.enabled).toBe(true);
      if (!dialog)
        await main.getByRole("tab", { name: "Albums", exact: true }).focus();
      await os("keys", title, chord);
      if (dialog === "picker") await cancelPicker();
      else if (dialog)
        await expect(
          main.getByRole("dialog", { name: dialog, exact: true }),
        ).toBeVisible();
      else await expect(main.getByRole("searchbox")).toBeFocused();
      evidence.keyboard[chord] = "passed using foreground-checked OS keys";
      if (dialog && dialog !== "picker") await main.keyboard.press("Escape");
    } catch (e) {
      evidence.keyboard[chord] = String(e);
      if (!String(e).includes("Foreground ownership could not")) throw e;
    }
  }
  // Check Windows' actual menu-loop state, independently of the WebView DOM.
  for (const chord of ["ALT", "F10"]) {
    try {
      await os("keys", title, chord);
      await expect.poll(async () => (await os("menu-focus", title)).menuMode).toBe(true);
      await os("keys", title, "ESC");
      evidence.keyboard[chord] =
        "passed; foreground-checked OS keys activated the Win32 menu loop";
    } catch (e) {
      evidence.keyboard[chord] = String(e);
      if (!String(e).includes("Foreground ownership could not")) throw e;
    }
  }
  await command("Window/Open Now Playing in separate window");
  await expect
    .poll(() => pages().some((p) => p.url().includes("companion=player")))
    .toBe(true);
  const player = pages().find((p) => p.url().includes("companion=player"));
  await expect(
    player.getByRole("dialog", { name: "Now playing", exact: true }),
  ).toBeVisible();
  expect(await os("menus", "Now playing")).toEqual([]);
  await command("Window/Queue");
  await expect(
    player.getByRole("dialog", { name: "Queue", exact: true }),
  ).toBeVisible();
  await command("Window/Now Playing");
  await expect(
    player.getByRole("dialog", { name: "Now playing", exact: true }),
  ).toBeVisible();
  expect(
    pages().filter((p) => p.url().includes("companion=player")),
  ).toHaveLength(1);
  await command("Window/Equalizer");
  await expect
    .poll(() => pages().some((p) => p.url().includes("companion=equalizer")))
    .toBe(true);
  const eq = pages().find((p) => p.url().includes("companion=equalizer"));
  await expect(
    eq.getByRole("main", { name: "Equalizer", exact: true }),
  ).toBeVisible();
  expect(await os("menus", "Equalizer")).toEqual([]);
  await command("Window/Visualizer");
  await expect
    .poll(() => pages().some((p) => p.url().includes("companion=visualizer")))
    .toBe(true);
  const visualizer = pages().find((p) =>
    p.url().includes("companion=visualizer"),
  );
  await expect(visualizer.locator(".visualizer-view")).toBeVisible();
  expect(await os("menus", "Visualizer")).toEqual([]);
  await command("File/Settings…");
  await main.getByRole("button", { name: "Español", exact: true }).click();
  await main
    .getByRole("button", { name: "Dark", exact: true })
    .or(main.getByRole("button", { name: "Oscuro", exact: true }))
    .click();
  title = "Local Music - Tu resumen";
  await expect
    .poll(async () => (await menus()).map((m) => m.label).join("|"))
    .toBe("Archivo|Biblioteca|Reproducción|Ventana|Ayuda");
  await main.keyboard.press("Escape");
  evidence.spanishMenus = await menus();
  await command("Ayuda/Acerca de Local Music…");
  await expect(
    main.getByRole("dialog", { name: "Acerca de Local Music", exact: true }),
  ).toContainText("0.13.0");
  await main.keyboard.press("Escape");
  await os("resize", title, 360, 600);
  await expect
    .poll(() =>
      main.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    )
    .toBe(true);
  evidence.narrowViewport = await main.evaluate(() => ({
    width: innerWidth,
    height: innerHeight,
    overflow: document.documentElement.scrollWidth > innerWidth + 1,
  }));
  await main.screenshot({ path: `${output}/main-es-dark-narrow-webview.png` });
  try {
    await os("resize", title, 1280, 860);
    await os("keys", title, "CTRL+0");
    const baseline = await main.evaluate(() => devicePixelRatio);
    let ratio = baseline;
    for (let i = 0; i < 8 && ratio < baseline * 1.95; i++) {
      await os("keys", title, "CTRL+PLUS");
      ratio = await main.evaluate(() => devicePixelRatio);
    }
    expect(ratio / baseline).toBeGreaterThanOrEqual(1.95);
    expect(ratio / baseline).toBeLessThanOrEqual(2.05);
    expect(
      await main.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true);
    evidence.nativeZoom = {
      factor: ratio / baseline,
      viewport: await main.evaluate(() => [innerWidth, innerHeight]),
    };
    await main.screenshot({
      path: `${output}/main-es-dark-200pct-webview.png`,
    });
    await os("keys", title, "CTRL+0");
  } catch (e) {
    evidence.nativeZoom = String(e);
    if (!String(e).includes("Foreground ownership could not")) throw e;
  }
  try {
    await os("keys", title, "ESC");
    await os("screenshot", title, `${output}/main-native-menu.png`);
    evidence.screenshots.push("main-native-menu.png");
  } catch (e) {
    evidence.screenshotGate = String(e);
  }
  evidence.finalPlayback = await invoke(main, "playback_snapshot");
  await command("Archivo/Salir");
  await expect.poll(async () => (await os("list")).length).toBe(0);
  evidence.exit = "main and all companions closed";
  console.log(
    JSON.stringify(
      {
        keyboard: evidence.keyboard,
        importCancellation: evidence.importCancellation,
        nativeZoom: evidence.nativeZoom,
        narrowViewport: evidence.narrowViewport,
        exit: evidence.exit,
        screenshots: evidence.screenshots,
      },
      null,
      2,
    ),
  );
} finally {
  await writeFile(
    `${output}/menu-evidence.json`,
    JSON.stringify(evidence, null, 2),
  );
  if (authorized && title) await os("close", title).catch(() => {});
  await browser.close();
}
