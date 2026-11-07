/** Real WebView2 UI smoke check; only the isolated synthetic audit profile.
 * node scripts/verify-ui-audit.mjs PORT PID
 * Seed with tests/native/seed-detached-player.py, identity below.
 */
import { chromium, expect as assertion } from "@playwright/test";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { writeFile } from "node:fs/promises";
const [port, pid] = process.argv.slice(2),
  output = "artifacts/ui-audit-native";
if (!/^\d+$/.test(port ?? "") || !/^\d+$/.test(pid ?? ""))
  throw Error("Pass owned probe PORT PID");
const browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`),
  main = browser
    .contexts()[0]
    .pages()
    .find((p) => !p.url().includes("companion=")),
  expect = assertion.configure({ timeout: 20_000 }),
  run = promisify(execFile);
if (!main) throw Error("Missing main window");
const invoke = (command, args = {}) =>
  main.evaluate(
    ({ command, args }) => window.__TAURI_INTERNALS__.invoke(command, args),
    { command, args },
  );
const os = async (mode, title = "", ...args) =>
  JSON.parse(
    (
      await run(
        "python",
        ["tests/native/window-os.py", pid, mode, title, ...args.map(String)],
        { env: { ...process.env, PYTHONIOENCODING: "utf-8" } },
      )
    ).stdout,
  );
const evidence = { screenshots: [] },
  draftTitle = `Native audit ${Date.now()}`;
let authorized = false;
try {
  expect(await invoke("plugin:app|identifier")).toBe(
    "app.localmusic.auditprobe20261106",
  );
  authorized = true;
  await invoke("patch_settings", { patch: { language: "en", theme: "light" } });
  await expect(
    main.getByRole("tab", { name: "Songs", exact: true }),
  ).toBeVisible();
  evidence.version = await invoke("plugin:app|version");
  const initial = await invoke("playback_snapshot");
  expect(initial.playing).toBe(false);
  expect(initial.queue).toEqual(["native-0", "native-1", "native-2"]);
  for (let loop = 0; loop < 3; loop++)
    for (const name of [
      "Albums",
      "Artists",
      "Playlists",
      "Your Recap",
      "Songs",
    ]) {
      await main.getByRole("tab", { name, exact: true }).click();
      await expect(
        main.getByRole("tab", { name, exact: true }),
      ).toHaveAttribute("aria-selected", "true");
    }
  await main.getByRole("tab", { name: "Playlists", exact: true }).click();
  await main.getByRole("button", { name: "New playlist", exact: true }).click();
  const draft = main.getByRole("dialog", { name: "New playlist", exact: true });
  await draft.getByLabel("Playlist name", { exact: true }).fill(draftTitle);
  await draft.getByRole("checkbox").first().check();
  await draft.getByRole("button", { name: "Save", exact: true }).click();
  await expect(draft).toHaveCount(0);
  await main
    .getByRole("button", { name: "Library actions", exact: true })
    .click();
  await main.getByRole("menuitem", { name: "Settings", exact: true }).click();
  const settings = main.getByRole("dialog", { name: "Settings", exact: true });
  await expect(settings).toBeVisible();
  await expect(main.getByRole("dialog")).toHaveCount(1);
  await settings.getByRole("button", { name: "Dark", exact: true }).click();
  await settings.getByRole("button", { name: "Español", exact: true }).click();
  await expect(
    main.getByRole("dialog", { name: "Ajustes", exact: true }),
  ).toBeVisible();
  await main.screenshot({ path: `${output}/native-dark-settings.png` });
  evidence.screenshots.push("native-dark-settings.png");
  await main.keyboard.press("Escape");
  await expect(
    main.locator(".playlist-tile").filter({ hasText: draftTitle }),
  ).toBeVisible();
  await main.locator(".playlist-tile").filter({ hasText: draftTitle }).click();
  await main.getByRole("button", { name: "Editar lista", exact: true }).click();
  await main
    .getByRole("button", { name: "Guardar lista", exact: true })
    .click();
  await expect(
    main.getByRole("button", { name: "Editar lista", exact: true }),
  ).toBeVisible();
  await main.locator(".mini-track").click();
  const player = main.getByRole("dialog", {
    name: "Reproduciendo",
    exact: true,
  });
  await expect(player).toBeVisible();
  await player.getByRole("button", { name: "Cola", exact: true }).click();
  await expect(
    main.getByRole("dialog", { name: "Cola", exact: true }),
  ).toBeVisible();
  expect(await main.evaluate(() => window.__musicBack())).toBe(true);
  await expect(player).toBeVisible();
  await main.keyboard.press("Escape");
  await expect(player).toHaveCount(0);
  const title = (await os("list")).find((w) => w.visible).title;
  evidence.sizes = [];
  for (const [width, height] of [
    [360, 600],
    [1280, 860],
  ]) {
    await os("resize", title, width, height);
    await main.waitForTimeout(150);
    const size = await main.evaluate(() => ({
      width: innerWidth,
      height: innerHeight,
      overflow: document.documentElement.scrollWidth - innerWidth,
    }));
    expect(size.overflow).toBeLessThanOrEqual(1);
    evidence.sizes.push(size);
  }
  await main.screenshot({ path: `${output}/native-playlist-es.png` });
  evidence.screenshots.push("native-playlist-es.png");
  const final = await invoke("playback_snapshot");
  expect(final.queue).toEqual(initial.queue);
  expect(final.playing).toBe(false);
  evidence.realNativeSave = true;
  evidence.queueUnchanged = true;
  evidence.backBridgeReturnedToPlayer = true;
  console.log(JSON.stringify(evidence, null, 2));
} finally {
  await writeFile(
    `${output}/native-evidence.json`,
    JSON.stringify(evidence, null, 2),
  );
  if (authorized) await os("close").catch(() => {});
  await browser.close();
}
