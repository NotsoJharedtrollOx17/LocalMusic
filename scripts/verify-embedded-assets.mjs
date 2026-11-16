/** Verify the frozen JS/CSS payloads, including workers, in a shipped binary.
 * Tauri stores content-addressed Brotli assets under each crate OUT_DIR.
 * Compare decompressed bytes with dist and then locate the exact encoded bytes
 * in the executable/library. HTML is transformed by Tauri's CSP injector.
 */
import { readFileSync, readdirSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { brotliDecompressSync } from "node:zlib";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";

const args = Object.fromEntries(process.argv.slice(2).reduce((pairs, arg, i, all) =>
  i % 2 ? pairs : [...pairs, [arg, all[i + 1]]], []));
assert(args["--binary"] && args["--build"] && args["--output"],
  "Use --binary FILE --build TARGET/release/build --output REPORT.json");
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const binary = readFileSync(args["--binary"]), encoded = new Map();
const stats = { directories: [], scanned: 0, embedded: 0, hashes: [], buildEntries: readdirSync(args["--build"]) };
const directories = [];
function discover(root, depth = 0) {
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const path = join(root, entry.name);
    if (entry.name === "tauri-codegen-assets") directories.push(path);
    else if (depth < 3) discover(path, depth + 1);
  }
}
discover(args["--build"]);
for (const directory of directories) {
  stats.directories.push(directory);
  for (const file of readdirSync(directory).filter((n) => /\.(js|css)$/.test(n))) {
    const data = readFileSync(join(directory, file));
    stats.scanned++;
    let plain;
    try { plain = brotliDecompressSync(data); } catch { plain = data; }
    const key = hash(plain);
    stats.hashes.push(key);
    if (binary.includes(data)) { encoded.set(key, data.length); stats.embedded++; }
  }
}
const assets = readdirSync("dist/assets").filter((n) => /\.(js|css)$/.test(n)).map((name) => {
  const sha256 = hash(readFileSync(join("dist/assets", name)));
  assert(encoded.has(sha256), `Frozen frontend payload missing or changed: ${name}; expected ${sha256}; diagnostic ${JSON.stringify(stats)}`);
  return { path: `assets/${name}`, sha256, embeddedBytes: encoded.get(sha256) };
});
assert(assets.length > 0, "No frontend assets checked");
const report = { binarySha256: hash(binary), frozenFrontendMatches: true, assets };
mkdirSync(dirname(args["--output"]), { recursive: true });
writeFileSync(args["--output"], JSON.stringify(report, null, 2));
console.log(`Verified ${assets.length} frozen JS/CSS payloads in ${args["--binary"]}`);
