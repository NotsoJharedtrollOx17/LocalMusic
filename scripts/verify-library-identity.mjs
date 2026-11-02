/** Real native smoke checks. Refuses every profile except the isolated identity probe. */
import { chromium, expect } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
const [port, pid, output] = process.argv.slice(2);
if (
  !port ||
  !/^\d+$/.test(pid ?? "") ||
  !output?.startsWith("artifacts/library-identity/")
)
  throw Error("Expected isolated probe PORT PID OUTPUT");
const run = promisify(execFile),
  browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`),
  page = browser
    .contexts()[0]
    .pages()
    .find((p) => !p.url().includes("companion="));
if (!page) throw Error("Missing main page");
const invoke = (command, args = {}) =>
  page.evaluate(
    ({ command, args }) => window.__TAURI_INTERNALS__.invoke(command, args),
    { command, args },
  );
const os = (mode, ...args) =>
  run(
    "python",
    [
      "tests/native/window-os.py",
      pid,
      mode,
      "Local Music - Your Recap",
      ...args,
    ],
    { env: { ...process.env, PYTHONIOENCODING: "utf-8" } },
  );
const evidence = {};
let authorized = false;
try {
  await page.waitForFunction(() => window.__TAURI_INTERNALS__?.invoke);
  expect(await invoke("plugin:app|identifier")).toBe(
    "app.localmusic.identityprobe20261101",
  );
  authorized = true;
  await mkdir(output, { recursive: true });
  const initial = await invoke("library_organization");
  expect(initial.tracks).toHaveLength(12);
  expect(initial.songCandidates.length).toBeGreaterThan(0);
  expect(initial.albumCandidates.length).toBeGreaterThan(0);
  let state = await invoke("organize_library", {
    revision: initial.state.revision,
    action: {
      op: "songLink",
      ids: ["native-0", "native-1"],
      preferred: "native-1",
    },
  });
  const a = initial.tracks.find((t) => t.id === "native-0"),
    b = initial.tracks.find((t) => t.id === "native-1");
  state = await invoke("organize_library", {
    revision: state.revision,
    action: {
      op: "albumLink",
      keys: [a.sourceAlbumId, b.sourceAlbumId],
      title: "Native canonical album",
      artist: "Lead",
      coverId: "native-0",
    },
  });
  let groups = await invoke("list_groups", {
    kind: "albums",
    offset: 0,
    query: "Native canonical",
  });
  expect(groups.total).toBe(1);
  expect(groups.groups[0].ids).toHaveLength(3);
  evidence.canonicalGroup = groups.groups[0].id;
  await page.getByRole("button", { name: "Library actions" }).click();
  await page.getByRole("menuitem", { name: "Settings", exact: true }).click();
  await page
    .getByRole("button", { name: "Organize library", exact: true })
    .click();
  const dialog = page.getByRole("dialog", {
    name: "Organize library",
    exact: true,
  });
  await expect(dialog.locator(".organization-body")).toBeVisible();
  await dialog.getByRole("button", { name: "Albums", exact: true }).click();
  await expect(
    dialog.getByText("Native canonical album", { exact: true }),
  ).toBeVisible();
  await page.screenshot({ path: `${output}/native-organization-en.png` });
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  await invoke("set_repeat", { value: "off" });
  await invoke("set_shuffle", { value: false });
  await invoke("set_excluded", { value: false });
  await invoke("play_queue", { ids: ["native-0", "native-1"], index: 0 });
  await page.waitForTimeout(2000);
  const started = await invoke("playback_snapshot");
  expect(started.playing).toBe(true);
  expect(started.positionMs).toBeGreaterThan(200);
  evidence.outputMode = started.outputMode;
  await invoke("seek", { ms: 60000 });
  await page.waitForTimeout(2000);
  await invoke("toggle_playback");
  const paused = await invoke("playback_snapshot");
  await page.waitForTimeout(1500);
  expect((await invoke("playback_snapshot")).positionMs).toBe(
    paused.positionMs,
  );
  const year = new Date().getFullYear();
  const request = { kind: "year", anchorDate: `${year}-01-01` };
  let recap = await invoke("get_recap", { request });
  expect(recap.qualifiedPlays).toBe(0);
  expect(recap.listenedMs).toBeLessThan(15000);
  evidence.seekDidNotAddTime = recap.listenedMs;
  await invoke("toggle_playback");
  await page.waitForTimeout(32000);
  await invoke("toggle_playback");
  recap = await invoke("get_recap", { request });
  expect(recap.qualifiedPlays).toBe(1);
  expect(recap.topTracks[0].track.id).toBe("native-1");
  expect(recap.topAlbums[0].name).toBe("Native canonical album");
  expect(recap.listenedMs).toBeGreaterThanOrEqual(30000);
  expect(recap.listenedMs).toBeLessThan(45000);
  evidence.recordedListening = recap.listenedMs;
  await invoke("set_excluded", { value: true });
  expect((await invoke("get_recap", { request })).qualifiedPlays).toBe(0);
  await invoke("set_excluded", { value: false });
  expect((await invoke("get_recap", { request })).qualifiedPlays).toBe(1);
  await invoke("seek", { ms: 119000 });
  await invoke("toggle_playback");
  await expect
    .poll(async () => (await invoke("playback_snapshot")).trackId, {
      timeout: 10000,
    })
    .toBe("native-1");
  if ((await invoke("playback_snapshot")).playing)
    await invoke("toggle_playback");
  evidence.completionAdvancedQueue = true;
  evidence.version = await invoke("plugin:app|version");
  evidence.frozenOriginalCredit = (
    await invoke("tracks_by_id", { ids: ["native-0"] })
  )[0].artist;
  evidence.identityAndAccounting = true;
  await writeFile(
    `${output}/native-evidence.json`,
    JSON.stringify(evidence, null, 2),
  );
  console.log(JSON.stringify(evidence, null, 2));
} finally {
  await writeFile(
    `${output}/native-evidence.json`,
    JSON.stringify(evidence, null, 2),
  ).catch(() => {});
  if (authorized) await os("close").catch(() => {});
  await browser.close();
}
