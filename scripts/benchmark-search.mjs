import { chromium } from "@playwright/test";
import { writeFile, mkdir } from "node:fs/promises";
const mode = process.argv[2],
  url = process.argv[3];
if (!new Set(["popup", "inline"]).has(mode) || !url)
  throw new Error("Usage: node scripts/benchmark-search.mjs popup|inline URL");
const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
  });
  const page = await context.newPage();
  page.setDefaultTimeout(90000);
  console.log("benchmark: loading", mode);
  await page.goto(url);
  await page.getByRole("tab", { name: "Songs", exact: true }).waitFor();
  await page.evaluate(async () => {
    const db = await new Promise((resolve, reject) => {
      const r = indexedDB.open("local-music-v1");
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
    await new Promise((resolve, reject) => {
      const tx = db.transaction("tracks", "readwrite");
      for (let i = 0; i < 10000; i++) {
        const id = `benchmark-${i}`;
        tx.objectStore("tracks").put(
          {
            id,
            title: `Benchmark song ${String(i).padStart(5, "0")}`,
            artist: `Artist ${i % 100}`,
            album: `Album ${i % 250}`,
            sourceUri: `/fixture/${id}`,
            durationMs: 60000,
            genre: "",
            available: true,
            favorite: false,
            orderMetadataRead: true,
            releaseMetadataRead: true,
            importSequence: i,
            file: new Blob(),
          },
          id,
        );
      }
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  });
  console.log("benchmark: seeded");
  await page.reload();
  await page.getByText("10,000 songs", { exact: true }).waitFor();
  await page
    .getByRole("button", { name: "Search your library", exact: true })
    .click();
  console.log("benchmark: search opened");
  const input = page.getByRole("searchbox");
  await input.fill("song 00001");
  const area = mode === "popup" ? ".search-results" : "#library-content";
  await page.locator(`${area} [data-track-id="benchmark-1"]`).waitFor();
  await page.waitForFunction((area) => {
    const node = document.querySelector(area);
    return (
      node?.getAttribute("aria-busy") !== "true" &&
      node?.querySelectorAll(".track-row").length === 1
    );
  }, area);
  console.log("benchmark: warmed");
  const results = [];
  for (const id of [
    9999, 8888, 7777, 6666, 5555, 4444, 9999, 8888, 7777, 6666, 5555, 4444,
  ]) {
    await page.evaluate(
      ({ area, id }) => {
        window.__searchMeasurement = new Promise((resolve, reject) => {
          const deadline = setTimeout(
            () =>
              reject(
                new Error(
                  "measurement timed out: " +
                    id +
                    " " +
                    document.querySelector(area)?.textContent?.slice(0, 160),
                ),
              ),
            60000,
          );
          const input = document.querySelector('input[type="search"]');
          input.addEventListener(
            "input",
            () => {
              const start = performance.now();
              let paintMs, resultsMs;
              const finish = () => {
                if (paintMs !== undefined && resultsMs !== undefined) {
                  clearTimeout(deadline);
                  resolve({ paintMs, resultsMs });
                }
              };
              requestAnimationFrame(() =>
                requestAnimationFrame(() => {
                  paintMs = performance.now() - start;
                  finish();
                }),
              );
              const node = document.querySelector(area);
              const observer = new MutationObserver(() => {
                if (
                  node.querySelector(`[data-track-id="benchmark-${id}"]`) &&
                  node.getAttribute("aria-busy") !== "true"
                ) {
                  observer.disconnect();
                  requestAnimationFrame(() =>
                    requestAnimationFrame(() => {
                      resultsMs = performance.now() - start;
                      finish();
                    }),
                  );
                }
              });
              observer.observe(node, {
                subtree: true,
                attributes: true,
                childList: true,
              });
            },
            { once: true },
          );
        });
      },
      { area, id },
    );
    await input.fill(`song ${String(id).padStart(5, "0")}`);
    const sample = await page.evaluate(() => window.__searchMeasurement);
    results.push({ id, ...sample });
    console.log("sample", id, sample);
  }
  const percentile = (values, p) =>
    [...values].sort((a, b) => a - b)[Math.ceil(values.length * p) - 1];
  const report = {
    mode,
    tracks: 10000,
    browser: browser.version(),
    samples: results,
    p95PaintMs: percentile(
      results.map((x) => x.paintMs),
      0.95,
    ),
    p95ResultsMs: percentile(
      results.map((x) => x.resultsMs),
      0.95,
    ),
    cachedP95ResultsMs: percentile(
      results.slice(6).map((x) => x.resultsMs),
      0.95,
    ),
  };
  await mkdir("artifacts", { recursive: true });
  await writeFile(
    `artifacts/search-benchmark-${mode}.json`,
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report));
} finally {
  await browser.close();
}
