import { chromium, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { createServer } from "node:http";
import {
  readFileSync,
  existsSync,
  writeFileSync,
  mkdirSync,
  statSync,
} from "node:fs";
import { resolve, extname, sep } from "node:path";
import assert from "node:assert/strict";
const root = resolve("artifacts/landing-site"),
  out = "artifacts/landing-page";
mkdirSync(out, { recursive: true });
const server = createServer((req, res) => {
  const url = new URL(req.url, "http://localhost");
  const name = url.pathname.replace(/^\/LocalMusic\//, "/");
  const p = resolve(root, "." + decodeURIComponent(name));
  if (!(p === root || p.startsWith(root + sep)) || !existsSync(p)) {
    res.statusCode = 404;
    res.end();
    return;
  }
  const file = p === root ? root + "/index.html" : p;
  if (!statSync(file).isFile()) {
    res.statusCode = 404;
    res.end();
    return;
  }
  res.setHeader(
    "Content-Type",
    {
      ".js": "text/javascript",
      ".css": "text/css",
      ".svg": "image/svg+xml",
      ".html": "text/html",
      ".woff2": "font/woff2",
      ".png": "image/png",
      ".txt": "text/plain",
    }[extname(file)] ?? "application/octet-stream",
  );
  res.end(readFileSync(file));
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const url = "http://127.0.0.1:" + server.address().port + "/LocalMusic/";
const browser = await chromium.launch();
const report = { views: [], errors: [], requests: [] };
try {
  const context = await browser.newContext({ colorScheme: "light" }),
    page = await context.newPage();
  page.on("pageerror", (e) => report.errors.push(e.message));
  page.on("response", (r) => {
    if (r.status() >= 400)
      report.requests.push({ url: r.url(), status: r.status() });
  });
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto(url, { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Your music.A little more you.",
    );
    if (width < 720)
      assert.equal(
        (await page.locator("#recap-title").innerText()).replace(/\s+/g, " "),
        "Some songs stick around.",
      );
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    );
    assert(!overflow, "Horizontal overflow at " + width);
    for (const img of await page.locator("img").all()) {
      await img.scrollIntoViewIfNeeded();
      assert(
        await img.evaluate(async (i) => {
          await i.decode();
          return i.naturalWidth > 0;
        }),
      );
    }
    await page.getByRole("link", { name: "Geometry", exact: true }).click();
    await expect(page.locator("#visualizer-image")).toHaveAttribute(
      "src",
      "assets/visualizer-geometry.png",
    );
    await expect(
      page.getByRole("link", { name: "Geometry", exact: true }),
    ).toHaveAttribute("aria-current", "true");
    await page.getByRole("link", { name: "XMB wave", exact: true }).focus();
    await page.keyboard.press("Enter");
    await expect(page.locator("#visualizer-image")).toHaveAttribute(
      "src",
      "assets/visualizer-xmb.png",
    );
    await page.getByRole("link", { name: "Spectrum", exact: true }).click();
    await page.getByRole("button", { name: "Switch to dark theme" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    const dark = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    assert.deepEqual(dark.violations, [], `Dark accessibility at ${width}`);
    if (width === 1440)
      await page.screenshot({ path: `${out}/landing-dark-1440.png` });
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await page.getByRole("button", { name: "Switch to light theme" }).click();
    await page.getByRole("link", { name: "Meet the project" }).hover();
    const light = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    assert.deepEqual(light.violations, [], `Light accessibility at ${width}`);
    await page
      .getByText("Moving from an earlier Android debug build?", { exact: true })
      .click();
    await expect(page.locator(".install-note")).toHaveAttribute("open", "");
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({
      path: `${out}/landing-${width}.png`,
      fullPage: true,
    });
    report.views.push({
      width,
      noOverflow: true,
      imagesDecoded: true,
      modeSelection: true,
      keyboardActivation: true,
      themePersistence: true,
      axeViolations: 0,
    });
  }
  await page.emulateMedia({ reducedMotion: "reduce" });
  assert.equal(
    await page.evaluate(
      () => getComputedStyle(document.documentElement).scrollBehavior,
    ),
    "auto",
  );
  report.reducedMotion = true;
  await page.goto(url);
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Skip to content" }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("main")).toBeFocused();
  report.skipLink = true;
  const urls = await page
    .locator(".download-actions a")
    .evaluateAll((as) => as.map((a) => a.href));
  assert.equal(urls.length, 3);
  const version = (
    await page.locator(".release-links > span").innerText()
  ).match(/\d+\.\d+\.\d+/)[0];
  assert.deepEqual(
    urls,
    [
      "windows-x64-setup.exe",
      "windows-x64-portable.zip",
      "android-arm64.apk",
    ].map(
      (n) =>
        "https://github.com/NotsoJharedtrollOx17/LocalMusic/releases/download/v" +
        version +
        "/Local-Music-v" +
        version +
        "-" +
        n,
    ),
  );
  report.downloadLinks = urls;
  const noJS = await browser.newContext({
      javaScriptEnabled: false,
      viewport: { width: 390, height: 844 },
    }),
    plain = await noJS.newPage();
  await plain.goto(url);
  await expect(
    plain.getByRole("link", { name: "Download for Android" }),
  ).toBeVisible();
  await expect(
    plain.getByRole("link", { name: "Geometry", exact: true }),
  ).toHaveAttribute("href", "assets/visualizer-geometry.png");
  report.noJavaScriptFallback = true;
  await noJS.close();
  assert.deepEqual(report.errors, []);
  assert.deepEqual(report.requests, []);
  report.passed = true;
} finally {
  writeFileSync(
    out + "/website-verification.json",
    JSON.stringify(report, null, 2),
  );
  await browser.close();
  server.closeAllConnections();
  await new Promise((r) => server.close(r));
}
console.log(JSON.stringify(report, null, 2));
