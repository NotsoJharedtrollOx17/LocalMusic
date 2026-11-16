import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
const root = resolve(import.meta.dirname, ".."),
  out = resolve(root, "artifacts/brand-icons");
const mark = readFileSync(resolve(root, "src/brand/mark.svg"), "utf8");
const inner = mark.replace(/^<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "");
// Adaptive-icon foregrounds extend beyond the launcher's visible mask.
// Pad the same master explicitly so its ring survives circular/squircle crops.
const androidSource = resolve(root, "artifacts/brand-source");
mkdirSync(androidSource, { recursive: true });
writeFileSync(
  resolve(androidSource, "android-mark.svg"),
  '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="-30 -30 160 160">' +
    inner +
    "</svg>",
);
writeFileSync(
  resolve(root, "public/icon.svg"),
  '<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 100 100"><rect width="100" height="100" rx="20" fill="#faf8f4"/>' +
    inner +
    "</svg>",
);
const result = spawnSync(
  process.execPath,
  [
    resolve(root, "node_modules/@tauri-apps/cli/tauri.js"),
    "icon",
    resolve(root, "src/brand/icon-manifest.json"),
    "--output",
    out,
  ],
  { cwd: root, stdio: "inherit", windowsHide: true },
);
if (result.status !== 0) process.exit(result.status ?? 1);
for (const file of [
  "icon.ico",
  "icon.png",
  "32x32.png",
  "64x64.png",
  "128x128.png",
  "128x128@2x.png",
])
  cpSync(resolve(out, file), resolve(root, "src-tauri/icons", file));
for (const dest of [
  "src-tauri/icons/android",
  "src-tauri/gen/android/app/src/main/res",
]) {
  mkdirSync(resolve(root, dest), { recursive: true });
  cpSync(resolve(out, "android"), resolve(root, dest), { recursive: true });
}
