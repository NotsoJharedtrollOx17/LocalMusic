/** Build the independent static landing page; never reuse the application's dist. */
import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from "node:fs";
import { resolve, join } from "node:path";
import assert from "node:assert/strict";
const root = resolve(import.meta.dirname, ".."),
  out = join(root, "artifacts/landing-site");
const releaseMetadata = process.env.SITE_RELEASE_METADATA
  ? JSON.parse(readFileSync(process.env.SITE_RELEASE_METADATA, "utf8"))
  : null;
const { version: packageVersion } = JSON.parse(
  readFileSync(join(root, "package.json"), "utf8"),
);
const version = releaseMetadata
  ? String(releaseMetadata.tag_name).replace(/^v/, "")
  : packageVersion;
assert(/^\d+\.\d+\.\d+$/.test(version));
if (releaseMetadata) {
  assert(
    !releaseMetadata.draft && !releaseMetadata.prerelease,
    "Only stable published releases may be advertised",
  );
  for (const name of [
    "android-arm64.apk",
    "windows-x64-setup.exe",
    "windows-x64-portable.zip",
  ])
    assert(
      releaseMetadata.assets.some(
        (a) => a.name === `Local-Music-v${version}-${name}`,
      ),
      `Missing release package ${name}`,
    );
}
const siteURL =
  process.env.SITE_URL ?? "https://notsojharedtrollox17.github.io/LocalMusic/";
assert(
  /^https:\/\/[a-zA-Z0-9./_-]+\/$/.test(siteURL),
  "Expected an HTTPS site URL ending in /",
);
const release = `https://github.com/NotsoJharedtrollOx17/LocalMusic/releases/tag/v${version}`;
const download = `https://github.com/NotsoJharedtrollOx17/LocalMusic/releases/download/v${version}/Local-Music-v${version}`;
const brand = readFileSync(join(root, "src/brand/mark.svg"), "utf8").replace(
  "#20221f",
  "currentColor",
);
const values = {
  VERSION: version,
  SITE_URL: siteURL,
  BRAND_MARK: brand,
  RELEASE_URL: release,
  WINDOWS_SETUP: download + "-windows-x64-setup.exe",
  WINDOWS_PORTABLE: download + "-windows-x64-portable.zip",
  ANDROID_APK: download + "-android-arm64.apk",
};
mkdirSync(join(out, "assets"), { recursive: true });
mkdirSync(join(out, "licenses"), { recursive: true });
const html = readFileSync(join(root, "website/index.html"), "utf8").replace(
  /__([A-Z_]+)__/g,
  (_, key) => {
    assert(key in values, `Unknown website placeholder: ${key}`);
    return values[key];
  },
);
assert(!/__([A-Z_]+)__/.test(html));
writeFileSync(join(out, "index.html"), html);
for (const name of ["style.css", "site.js"])
  copyFileSync(join(root, "website", name), join(out, name));
for (const name of [
  "recap-story.png",
  "recap-preview.png",
  "visualizer-spectrum.png",
  "visualizer-geometry.png",
  "visualizer-xmb.png",
  "windows-library.png",
  "android-library.png",
])
  copyFileSync(join(root, "docs/images", name), join(out, "assets", name));
for (const [source, name] of [
  ["src/brand/mark.svg", "mark.svg"],
  ["public/icon.svg", "icon.svg"],
  [
    "node_modules/@fontsource/space-grotesk/files/space-grotesk-latin-700-normal.woff2",
    "space-grotesk-700.woff2",
  ],
  [
    "node_modules/@fontsource/inter/files/inter-latin-400-normal.woff2",
    "inter-400.woff2",
  ],
  [
    "node_modules/@fontsource/inter/files/inter-latin-600-normal.woff2",
    "inter-600.woff2",
  ],
])
  copyFileSync(join(root, source), join(out, "assets", name));
for (const name of ["space-grotesk.txt", "inter.txt", "origin-of-symmetry.txt"])
  copyFileSync(
    join(root, "public/licenses", name),
    join(out, "licenses", name),
  );
copyFileSync(join(root, "LICENSE"), join(out, "LICENSE.txt"));
writeFileSync(join(out, ".nojekyll"), "");
writeFileSync(
  join(out, "robots.txt"),
  `User-agent: *\nAllow: /\nSitemap: ${siteURL}sitemap.xml\n`,
);
writeFileSync(
  join(out, "sitemap.xml"),
  `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${siteURL}</loc></url></urlset>`,
);
console.log(`Built Local Music ${version} landing page at ${out}`);
