/** Check local routes, references and deployable contents without network access. */
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { resolve, join, extname } from "node:path";
import assert from "node:assert/strict";
const root = resolve(import.meta.dirname, "../artifacts/landing-site"),
  html = readFileSync(join(root, "index.html"), "utf8");
const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]);
assert.equal(new Set(ids).size, ids.length, "Duplicate anchor IDs");
for (const [, name] of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
  if (name.startsWith("#"))
    assert(ids.includes(name.slice(1)), `Missing anchor ${name}`);
  else if (!/^https:\/\//.test(name))
    assert(existsSync(join(root, name)), `Missing asset ${name}`);
}
for (const [, path] of readFileSync(join(root, "style.css"), "utf8").matchAll(
  /url\(([^)]+)\)/g,
))
  assert(existsSync(join(root, path)), `Missing font ${path}`);
for (const [, tag] of html.matchAll(/(<img\b[^>]+>)/g))
  assert(/\balt="[^"]*"/.test(tag), "Image lacks alt text");
assert(html.includes("Abraham Jhared Flores Azcona"));
assert(!/__([A-Z_]+)__/.test(html), "Unresolved template values");
assert(
  !/https?:\/\//.test(readFileSync(join(root, "site.js"), "utf8")),
  "Client script must not call external services",
);
const allowed = new Set([
  ".html",
  ".css",
  ".js",
  ".png",
  ".svg",
  ".woff2",
  ".txt",
  ".xml",
  "",
]);
let bytes = 0,
  files = 0;
function check(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) {
      check(p);
      continue;
    }
    assert(
      allowed.has(extname(entry.name)),
      `Unexpected published file ${entry.name}`,
    );
    bytes += statSync(p).size;
    files++;
  }
}
check(root);
assert(bytes < 8 * 1024 * 1024, "Landing assets exceed the 8 MiB budget");
console.log(
  `Website references, anchors, attribution and publish allowlist passed (${files} files, ${(bytes / 1024 / 1024).toFixed(2)} MiB).`,
);
