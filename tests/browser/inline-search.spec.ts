import { taggedWav } from "./fixtures";
import { openSettings } from "./navigationHelpers";
import { seedInlineCatalog } from "./inlineSearchFixture";
import { installSearchGate, releaseSearch } from "./search-gate";
import { test, expect } from "@playwright/test";

test("inline search carries between tabs and restores parent search after details", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Explore with sample audio" }).click();
  await expect(page.getByText("8 songs", { exact: true })).toBeVisible();
  await page.getByRole("tab", { name: "Songs", exact: true }).focus();
  await page.keyboard.press("/");
  const input = page.getByRole("searchbox");
  await expect(input).toBeFocused();
  await input.fill("blue");
  await expect(page.locator("#library-content .track-row")).toHaveCount(4);
  await expect(input).toBeFocused();
  await page.getByRole("tab", { name: "Albums", exact: true }).click();
  await expect(input).toHaveValue("blue");
  await expect(input).toHaveAccessibleName("Search albums");
  await expect(page.locator(".album-card")).toHaveCount(2);
  const card = page
    .locator(".album-card")
    .filter({ hasText: "Quiet Assembly" });
  const title = await card.locator("strong").innerText();
  await card.click();
  await expect(
    page.getByRole("heading", { name: title, exact: true }).first(),
  ).toBeVisible();
  await expect(page.getByRole("search")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Search your library", exact: true })
    .click();
  await expect(input).toHaveValue("");
  await input.fill("rain");
  await expect(page.locator("#library-content .track-row")).toHaveCount(1);
  await page.keyboard.press("Escape");
  await expect(input).toHaveValue("");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("search")).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(input).toHaveValue("blue");
  await expect(page.locator(".album-card")).toHaveCount(2);
  await page.getByRole("tab", { name: "Your Recap", exact: true }).click();
  await expect(page.getByRole("search")).toHaveCount(0);
  await page.getByRole("tab", { name: "Songs", exact: true }).click();
  await expect(input).toHaveValue("blue");
  await expect(page.locator(".track-row")).toHaveCount(4);
  await page.getByRole("button", { name: "Close search", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Search your library", exact: true }),
  ).toBeFocused();
  await expect(page.locator(".track-row")).toHaveCount(8);
});

test("clear, literal queries and scoped playlist names preserve usable navigation", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 650 });
  await page.goto("/");
  await page.getByRole("button", { name: "Explore with sample audio" }).click();
  await expect(page.getByText("8 songs", { exact: true })).toBeVisible();
  await page.getByRole("tab", { name: "Playlists", exact: true }).click();
  await page
    .getByRole("button", { name: "Search your library", exact: true })
    .click();
  const input = page.getByRole("searchbox");
  await input.fill("favorites");
  await expect(page.locator(".automatic-playlist-tile")).toHaveCount(1);
  await expect(page.locator(".generator")).toBeHidden();
  await page.getByRole("button", { name: "Clear search", exact: true }).click();
  await expect(page.locator(".automatic-playlist-tile")).toHaveCount(4);
  await expect(page.locator(".generator")).toBeVisible();
  await page
    .locator(".generator")
    .evaluate((node) => node.setAttribute("data-retained", "yes"));
  await input.fill("%' OR 1=1");
  await expect(page.locator(".search-empty")).toBeVisible();
  await expect(page.locator(".generator")).toHaveAttribute(
    "data-retained",
    "yes",
  );
  await expect(page.locator(".generator")).toBeHidden();
  await page
    .locator(".search-empty")
    .getByRole("button", { name: "Clear search" })
    .click();
  await expect(page.locator(".generator")).toHaveAttribute(
    "data-retained",
    "yes",
  );
  await expect(page.locator(".generator")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "artifacts/inline-search-mobile.png",
    fullPage: true,
  });
});

test("search reaches unloaded tracks/groups and preserves pagination and filtered editing positions", async ({
  page,
}) => {
  await seedInlineCatalog(page);
  expect(await page.locator(".track-row").count()).toBeLessThan(60);
  await page
    .getByRole("button", { name: "Search your library", exact: true })
    .click();
  const input = page.getByRole("searchbox");
  await input.fill("129");
  await expect(page.locator(".track-copy strong")).toHaveText(["Needle last"]);
  await page.getByRole("tab", { name: "Albums", exact: true }).click();
  await expect(page.locator(".album-card strong")).toHaveText(["Record 129"]);
  await page.getByRole("tab", { name: "Artists", exact: true }).click();
  await expect(page.locator(".album-card strong")).toHaveText(["Person 129"]);
  await page.getByRole("tab", { name: "Songs", exact: true }).click();
  await input.fill("Song");
  await expect(page.getByRole("search")).toContainText("128 of 130 results");
  const firstHeight = await page
    .locator(".track-list")
    .evaluate((node) => node.getBoundingClientRect().height);
  await page.getByRole("button", { name: "Load more", exact: true }).click();
  await expect
    .poll(() =>
      page
        .locator(".track-list")
        .evaluate((node) => node.getBoundingClientRect().height),
    )
    .toBeGreaterThan(firstHeight);
  await page.getByRole("button", { name: "Load more", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Load more", exact: true }),
  ).toHaveCount(0);
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await expect(page.getByText("Song 128", { exact: true })).toBeVisible();
  const ids = await page
    .locator(".track-row")
    .evaluateAll((nodes) =>
      nodes.map((node) => node.getAttribute("data-track-id")),
    );
  expect(new Set(ids).size).toBe(ids.length);
  await page.getByRole("tab", { name: "Playlists", exact: true }).click();
  await input.fill("Needle");
  await expect(page.locator(".saved-playlist-card")).toHaveCount(1);
  await page.locator(".saved-playlist-card .playlist-tile").click();
  await expect(page.getByRole("search")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Search your library", exact: true })
    .click();
  await input.fill("Needle");
  await expect(page.locator(".track-copy strong")).toHaveText([
    "Needle first",
    "Needle last",
  ]);
  await page
    .getByRole("button", { name: "Edit playlist", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Move down", exact: true })
    .first()
    .click();
  await expect(page.locator(".track-copy strong")).toHaveText([
    "Needle last",
    "Needle first",
  ]);
  await page
    .getByRole("button", { name: "Save playlist", exact: true })
    .click();
  const saved = await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve) => {
      const r = indexedDB.open("local-music-v1");
      r.onsuccess = () => resolve(r.result);
    });
    return new Promise<string[]>((resolve) => {
      const r = db.transaction("playlists").objectStore("playlists").get("mix");
      r.onsuccess = () => {
        resolve(r.result.trackIds);
        db.close();
      };
    });
  });
  expect(saved).toEqual(["entry-0", "entry-129", "entry-2", "entry-1"]);
  await page.getByRole("button", { name: "Clear search", exact: true }).click();
  await page.getByRole("button", { name: "Close search", exact: true }).click();
  await page.getByRole("button", { name: "Playlists", exact: true }).click();
  await expect(input).toHaveValue("Needle");
  await expect(
    page.locator(".saved-playlist-card .playlist-tile"),
  ).toBeFocused();
});

test("late worker replies cannot replace newer results; controls stay reachable", async ({
  page,
}) => {
  await installSearchGate(page, "Signal");
  await page.goto("/");
  await page.getByRole("button", { name: "Explore with sample audio" }).click();
  await expect(page.getByText("8 songs", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Search your library", exact: true })
    .click();
  const input = page.getByRole("searchbox");
  await input.fill("Signal");
  await expect
    .poll(() => page.evaluate(() => (window as any).searchHeld))
    .toBe(true);
  await expect(page.locator("#library-content")).toHaveAttribute(
    "aria-busy",
    "true",
  );
  await input.fill("rain");
  await expect(page.locator(".track-copy strong")).toHaveText([
    "Blue after rain",
  ]);
  await releaseSearch(page);
  await expect(input).toBeFocused();
  await expect(page.locator(".track-copy strong")).toHaveText([
    "Blue after rain",
  ]);
  await input.press("Enter");
  await expect(page.locator(".mini-player")).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(page.locator(".track-row")).toHaveCount(8);
});

test("worker failure offers inline Retry without losing the query", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const Base = window.Worker;
    let fail = true;
    window.Worker = class extends Base {
      postMessage(message: any, transfer: any = []) {
        if (String(message.query) === "rain" && fail) {
          fail = false;
          setTimeout(
            () =>
              this.dispatchEvent(
                new ErrorEvent("error", { message: "fixture failure" }),
              ),
            0,
          );
        } else super.postMessage(message, transfer);
      }
    };
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Explore with sample audio" }).click();
  await expect(page.getByText("8 songs", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Search your library", exact: true })
    .click();
  const input = page.getByRole("searchbox");
  await input.fill("rain");
  await expect(page.getByRole("search")).toContainText("Search could not load");
  await expect(input).toHaveValue("rain");
  await page
    .getByRole("search")
    .getByRole("button", { name: "Try again", exact: true })
    .click();
  await expect(page.locator(".track-copy strong")).toHaveText([
    "Blue after rain",
  ]);
});

test("imports update an active search and scope labels follow Spanish and theme", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Explore with sample audio" }).click();
  await expect(page.getByText("8 songs", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Search your library", exact: true })
    .click();
  const input = page.getByRole("searchbox");
  await input.fill("Fresh arrival");
  await expect(page.locator(".search-empty")).toBeVisible();
  await page
    .locator('input[type="file"]')
    .first()
    .setInputFiles({
      name: "fresh.wav",
      mimeType: "audio/wav",
      buffer: taggedWav("Fresh arrival", 0, 1),
    });
  await expect(page.locator(".track-copy strong")).toHaveText([
    "Fresh arrival",
  ]);
  await expect(input).toHaveValue("Fresh arrival");
  const settings = await openSettings(page);
  await settings
    .getByRole("button", { name: "Espa\u00f1ol", exact: true })
    .click();
  await settings.getByRole("button", { name: "Oscuro", exact: true }).click();
  await settings.getByRole("button", { name: "Cerrar", exact: true }).click();
  await expect(input).toHaveAccessibleName("Buscar canciones");
  await page
    .getByRole("button", { name: "Borrar b\u00fasqueda", exact: true })
    .click();
  await page.getByRole("tab", { name: "Listas", exact: true }).click();
  await input.fill("Favoritas");
  await expect(page.locator(".automatic-playlist-tile")).toHaveCount(1);
  await expect(input).toBeFocused();
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 600 });
    await expect(input).toBeInViewport();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await page.screenshot({
    path: "artifacts/inline-search-es-dark.png",
    fullPage: true,
  });
});

test("artist subviews search album metadata separately and restore nested parents", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Explore with sample audio" }).click();
  await expect(page.getByText("8 songs", { exact: true })).toBeVisible();
  await page.getByRole("tab", { name: "Artists", exact: true }).click();
  await page
    .locator(".album-card")
    .filter({ hasText: "Quiet Assembly" })
    .click();
  await page
    .getByRole("button", { name: "Search your library", exact: true })
    .click();
  const input = page.getByRole("searchbox");
  await input.fill("blue");
  await expect(page.locator(".track-row")).toHaveCount(2);
  await page
    .locator(".artist-view")
    .getByRole("tab", { name: "Albums", exact: true })
    .click();
  await expect(page.locator(".album-card")).toHaveCount(1);
  await input.fill("rain");
  await expect(page.locator(".search-empty")).toBeVisible();
  await input.fill("blue");
  const card = page.locator(".album-card");
  await card.click();
  await expect(page.getByRole("search")).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(input).toHaveValue("blue");
  await expect(
    page
      .locator(".artist-view")
      .getByRole("tab", { name: "Albums", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await expect(card).toBeFocused();
});

test("Favorites and sort combine with a live query without onboarding flashes", async ({
  page,
}) => {
  await seedInlineCatalog(page);
  await page
    .getByRole("button", { name: "Search your library", exact: true })
    .click();
  await page.getByRole("searchbox").fill("needle");
  await expect(page.locator(".track-copy strong")).toHaveText([
    "Needle first",
    "Needle last",
  ]);
  await page
    .getByRole("button", { name: "Filter and sort", exact: true })
    .click();
  await page
    .getByRole("menuitemradio", { name: "Favorites", exact: true })
    .click();
  await expect(page.locator(".track-copy strong")).toHaveText(["Needle last"]);
  await page
    .getByRole("button", { name: "Filter and sort", exact: true })
    .click();
  await page
    .getByRole("menuitemradio", { name: "Sort by artist", exact: true })
    .click();
  await expect(page.locator(".track-copy strong")).toHaveText([
    "Needle first",
    "Needle last",
  ]);
  await expect(page.locator(".empty-library,.empty-favorites")).toHaveCount(0);
  await expect(page.getByRole("searchbox")).toHaveValue("needle");
});
