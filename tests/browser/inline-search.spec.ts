import { taggedWav } from "./fixtures";
import { openSettings } from "./navigationHelpers";
import { seedInlineCatalog } from "./inlineSearchFixture";
import { installSearchGate, releaseSearch } from "./search-gate";
import { test, expect, type Page, type Locator } from "@playwright/test";

async function revealSearch(page: Page) {
  if (!(await page.getByRole("searchbox").isVisible()))
    await page.locator("[data-search-trigger] button").first().click();
}
async function fillSearch(page: Page, input: Locator, text: string) {
  await revealSearch(page);
  await input.fill(text);
}

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
  await fillSearch(page, input, "blue");
  await expect(page.locator("#library-content .track-row")).toHaveCount(4);
  await expect(input).toBeFocused();
  await page.getByRole("tab", { name: "Albums", exact: true }).click();
  await revealSearch(page);
  await expect(input).toHaveValue("blue");
  await revealSearch(page);
  await expect(input).toHaveAccessibleName("Search albums");
  await expect(page.locator("#library-content .album-card")).toHaveCount(2);
  const card = page
    .locator("#library-content .album-card")
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
  await revealSearch(page);
  await expect(input).toHaveValue("");
  await fillSearch(page, input, "rain");
  await expect(page.locator("#library-content .track-row")).toHaveCount(1);
  await page.keyboard.press("Escape");
  await revealSearch(page);
  await expect(input).toHaveValue("");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("search")).toHaveCount(0);
  await page.keyboard.press("Escape");
  await revealSearch(page);
  await expect(input).toHaveValue("blue");
  await expect(page.locator("#library-content .album-card")).toHaveCount(2);
  await page.getByRole("tab", { name: "Your Recap", exact: true }).click();
  await expect(page.getByRole("search")).toHaveCount(0);
  await page.getByRole("tab", { name: "Songs", exact: true }).click();
  await revealSearch(page);
  await expect(input).toHaveValue("blue");
  await expect(page.locator("#library-content .track-row")).toHaveCount(4);
  await page.getByRole("button", { name: "Close search", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Search your library", exact: true }),
  ).toBeFocused();
  await expect(page.locator("#library-content .track-row")).toHaveCount(8);
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
  await fillSearch(page, input, "favorites");
  await expect(
    page.locator("#library-content .automatic-playlist-tile"),
  ).toHaveCount(1);
  await expect(page.locator("#library-content .generator")).toBeHidden();
  await page.getByRole("button", { name: "Clear search", exact: true }).click();
  await expect(
    page.locator("#library-content .automatic-playlist-tile"),
  ).toHaveCount(4);
  await expect(page.locator("#library-content .generator")).toBeVisible();
  await page
    .locator("#library-content .generator")
    .evaluate((node) => node.setAttribute("data-retained", "yes"));
  await fillSearch(page, input, "%' OR 1=1");
  await expect(page.locator("#library-content .search-empty")).toBeVisible();
  await expect(page.locator("#library-content .generator")).toHaveAttribute(
    "data-retained",
    "yes",
  );
  await expect(page.locator("#library-content .generator")).toBeHidden();
  await page
    .locator("#library-content .search-empty")
    .getByRole("button", { name: "Clear search" })
    .click();
  await expect(page.locator("#library-content .generator")).toHaveAttribute(
    "data-retained",
    "yes",
  );
  await expect(page.locator("#library-content .generator")).toBeVisible();
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
  expect(
    await page.locator("#library-content .track-row").count(),
  ).toBeLessThan(60);
  await page
    .getByRole("button", { name: "Search your library", exact: true })
    .click();
  const input = page.getByRole("searchbox");
  await fillSearch(page, input, "129");
  await expect(page.locator("#library-content .track-copy strong")).toHaveText([
    "Needle last",
  ]);
  await page.getByRole("tab", { name: "Albums", exact: true }).click();
  await expect(page.locator("#library-content .album-card strong")).toHaveText([
    "Record 129",
  ]);
  await page.getByRole("tab", { name: "Artists", exact: true }).click();
  await expect(page.locator("#library-content .album-card strong")).toHaveText([
    "Person 129",
  ]);
  await page.getByRole("tab", { name: "Songs", exact: true }).click();
  await fillSearch(page, input, "Song");
  await expect(page.locator("#library-content .collection-count")).toHaveText(
    "128 of 130 songs",
  );
  await expect(
    page.locator("#library-content [data-virtual-count]"),
  ).toHaveAttribute("data-virtual-count", "128");
  await expect(
    page.getByRole("button", { name: "Load more", exact: true }),
  ).toHaveCount(0);
  await page.evaluate(() =>
    (
      document.querySelector<HTMLElement>(
        '.library-pane[data-active="true"]',
      ) ?? window
    ).scrollTo(
      0,
      document.querySelector<HTMLElement>('.library-pane[data-active="true"]')
        ?.scrollHeight ?? document.body.scrollHeight,
    ),
  );
  await expect(page.getByText("Song 128", { exact: true })).toBeVisible();
  const ids = await page
    .locator("#library-content .track-row")
    .evaluateAll((nodes) =>
      nodes.map((node) => node.getAttribute("data-track-id")),
    );
  expect(new Set(ids).size).toBe(ids.length);
  await page.getByRole("tab", { name: "Playlists", exact: true }).click();
  await fillSearch(page, input, "Needle");
  await expect(
    page.locator("#library-content .saved-playlist-card"),
  ).toHaveCount(1);
  await page
    .locator("#library-content .saved-playlist-card .playlist-tile")
    .click();
  await expect(page.getByRole("search")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Search your library", exact: true })
    .click();
  await fillSearch(page, input, "Needle");
  await expect(page.locator("#library-content .track-copy strong")).toHaveText([
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
  await expect(page.locator("#library-content .track-copy strong")).toHaveText([
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
  await revealSearch(page);
  await page.getByRole("button", { name: "Clear search", exact: true }).click();
  await page.getByRole("button", { name: "Close search", exact: true }).click();
  await page.getByRole("button", { name: "Playlists", exact: true }).click();
  await expect(
    page.locator("#library-content .saved-playlist-card .playlist-tile"),
  ).toBeFocused();
  await revealSearch(page);
  await expect(input).toHaveValue("Needle");
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
  const resultTop = await page
    .locator("#library-content .track-row")
    .first()
    .evaluate((node) => node.getBoundingClientRect().top);
  await fillSearch(page, input, "Signal");
  await expect
    .poll(() => page.evaluate(() => (window as any).searchHeld))
    .toBe(true);
  await expect(page.locator("#library-content")).toHaveAttribute(
    "aria-busy",
    "true",
  );
  await expect(
    page.locator("[data-search-trigger] .loading-indicator"),
  ).toBeVisible();
  expect(
    Math.abs(
      (await page
        .locator("#library-content .track-row")
        .first()
        .evaluate((node) => node.getBoundingClientRect().top)) - resultTop,
    ),
  ).toBeLessThanOrEqual(1);
  await fillSearch(page, input, "rain");
  await expect(page.locator("#library-content .track-copy strong")).toHaveText([
    "Blue after rain",
  ]);
  await releaseSearch(page);
  await expect(input).toBeFocused();
  await expect(page.locator("#library-content .track-copy strong")).toHaveText([
    "Blue after rain",
  ]);
  await input.press("Enter");
  await expect(page.locator(".mini-player")).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(page.locator("#library-content .track-row")).toHaveCount(8);
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
  await fillSearch(page, input, "rain");
  await expect(page.locator(".inline-search-status")).toContainText(
    "Search could not load",
  );
  await revealSearch(page);
  await expect(input).toHaveValue("rain");
  await page
    .locator(".inline-search-status")
    .getByRole("button", { name: "Try again", exact: true })
    .click();
  await expect(page.locator("#library-content .track-copy strong")).toHaveText([
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
  await fillSearch(page, input, "Fresh arrival");
  await expect(page.locator("#library-content .search-empty")).toBeVisible();
  await page
    .locator('input[type="file"]')
    .first()
    .setInputFiles({
      name: "fresh.wav",
      mimeType: "audio/wav",
      buffer: taggedWav("Fresh arrival", 0, 1),
    });
  await expect(page.locator("#library-content .track-copy strong")).toHaveText([
    "Fresh arrival",
  ]);
  await revealSearch(page);
  await expect(input).toHaveValue("Fresh arrival");
  const settings = await openSettings(page);
  await settings
    .getByRole("button", { name: "Espa\u00f1ol", exact: true })
    .click();
  await settings.getByRole("button", { name: "Oscuro", exact: true }).click();
  await settings.getByRole("button", { name: "Cerrar", exact: true }).click();
  await revealSearch(page);
  await expect(input).toHaveAccessibleName("Buscar canciones");
  await page
    .getByRole("button", { name: "Borrar b\u00fasqueda", exact: true })
    .click();
  await page.getByRole("tab", { name: "Listas", exact: true }).click();
  await fillSearch(page, input, "Favoritas");
  await expect(
    page.locator("#library-content .automatic-playlist-tile"),
  ).toHaveCount(1);
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
    .locator("#library-content .album-card")
    .filter({ hasText: "Quiet Assembly" })
    .click();
  await page
    .getByRole("button", { name: "Search your library", exact: true })
    .click();
  const input = page.getByRole("searchbox");
  await fillSearch(page, input, "blue");
  await expect(page.locator("#library-content .track-row")).toHaveCount(2);
  await page
    .locator(".artist-view")
    .getByRole("tab", { name: "Albums", exact: true })
    .click();
  await expect(page.locator("#library-content .album-card")).toHaveCount(1);
  await fillSearch(page, input, "rain");
  await expect(page.locator("#library-content .search-empty")).toBeVisible();
  await fillSearch(page, input, "blue");
  const card = page.locator("#library-content .album-card");
  const albumTitle = await card.locator("strong").innerText();
  await card.click();
  await expect(
    page.getByRole("heading", { name: albumTitle, exact: true }).first(),
  ).toBeVisible();
  await expect(page.getByRole("search")).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(card).toBeFocused();
  await revealSearch(page);
  await expect(input).toHaveValue("blue");
  await expect(
    page
      .locator(".artist-view")
      .getByRole("tab", { name: "Albums", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
});

test("Favorites and sort combine with a live query without onboarding flashes", async ({
  page,
}) => {
  await seedInlineCatalog(page);
  await page
    .getByRole("button", { name: "Search your library", exact: true })
    .click();
  await page.getByRole("searchbox").fill("needle");
  await expect(page.locator("#library-content .track-copy strong")).toHaveText([
    "Needle first",
    "Needle last",
  ]);
  await page
    .getByRole("button", { name: "Filter and sort", exact: true })
    .click();
  await page
    .getByRole("menuitemradio", { name: "Favorites", exact: true })
    .click();
  await expect(page.locator("#library-content .track-copy strong")).toHaveText([
    "Needle last",
  ]);
  await page
    .getByRole("button", { name: "Filter and sort", exact: true })
    .click();
  await page
    .getByRole("menuitemradio", { name: "Sort by artist", exact: true })
    .click();
  await expect(page.locator("#library-content .track-copy strong")).toHaveText([
    "Needle first",
    "Needle last",
  ]);
  await expect(page.locator("#library-content .empty-library,.empty-favorites")).toHaveCount(0);
  await revealSearch(page);
  await expect(page.getByRole("searchbox")).toHaveValue("needle");
});

test("search shares the heading count and reflows from desktop left expansion to a narrow row", async ({
  page,
}) => {
  await seedInlineCatalog(page);
  await page
    .getByRole("button", { name: "Search your library", exact: true })
    .click();
  const input = page.getByRole("searchbox");
  const count = page.locator("#library-content .collection-count");
  await expect(count).toHaveText("130 songs");
  await expect(page.locator(".inline-search-status")).toBeEmpty();
  await fillSearch(page, input, "129");
  await expect(count).toHaveText("1 of 130 songs");
  await expect(count).toHaveAttribute("aria-busy", "false");
  await expect(page.locator(".search-announcement")).toHaveText(
    "1 of 130 results",
  );
  for (const [tab, text] of [
    ["Albums", "1 of 130 albums"],
    ["Artists", "1 of 130 artists"],
  ]) {
    await page.getByRole("tab", { name: tab, exact: true }).click();
    await expect(count).toHaveText(text);
  }
  await page.getByRole("tab", { name: "Playlists", exact: true }).click();
  await fillSearch(page, input, "Needle");
  await expect(count).toHaveText("1 of 5 playlists");
  for (const width of [1600, 1280, 1154, 1025]) {
    await page.setViewportSize({ width, height: 800 });
    await input.focus();
    const geometry = await page.evaluate(() => {
      const field = document
        .querySelector(".inline-search")!
        .getBoundingClientRect();
      const icon = document
        .querySelector("[data-search-trigger]")!
        .getBoundingClientRect();
      return {
        right: field.right,
        iconLeft: icon.left,
        centers: Math.abs(
          field.y + field.height / 2 - icon.y - icon.height / 2,
        ),
        overflow: document.documentElement.scrollWidth - innerWidth,
      };
    });
    expect(geometry.right).toBeLessThanOrEqual(geometry.iconLeft + 1);
    expect(geometry.centers).toBeLessThanOrEqual(1);
    expect(geometry.overflow).toBeLessThanOrEqual(1);
    await expect(input).toBeFocused();
    await expect(
      page.getByRole("button", { name: "Clear search", exact: true }),
    ).toBeInViewport();
  }
  await page.screenshot({
    path: "artifacts/inline-search-desktop-header.png",
    fullPage: true,
  });
  for (const width of [1024, 390, 320]) {
    await page.setViewportSize({ width, height: 600 });
    const geometry = await page.evaluate(() => {
      const field = document
        .querySelector(".inline-search")!
        .getBoundingClientRect();
      const tabs = document
        .querySelector(".section-tabs")!
        .getBoundingClientRect();
      const nav = document
        .querySelector(".library-navigation")!
        .getBoundingClientRect();
      return {
        top: field.top,
        tabsBottom: tabs.bottom,
        left: Math.abs(field.left - nav.left),
        right: Math.abs(field.right - nav.right),
        overflow: document.documentElement.scrollWidth - innerWidth,
      };
    });
    expect(geometry.top).toBeGreaterThanOrEqual(geometry.tabsBottom - 1);
    expect(geometry.left).toBeLessThanOrEqual(1);
    expect(geometry.right).toBeLessThanOrEqual(1);
    expect(geometry.overflow).toBeLessThanOrEqual(1);
    await expect(input).toBeFocused();
    await expect(
      page.getByRole("button", { name: "Close search", exact: true }),
    ).toBeInViewport();
  }
  const settings = await openSettings(page);
  await settings.getByRole("button", { name: /Espa/, exact: false }).click();
  await settings.getByRole("button", { name: "Oscuro", exact: true }).click();
  await settings.getByRole("button", { name: "Cerrar", exact: true }).click();
  await fillSearch(page, input, "Favoritas");
  await expect(count).toHaveText("1 de 5 listas");
  await page.screenshot({
    path: "artifacts/inline-search-narrow-header.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Borrar b\u00fasqueda", exact: true })
    .click();
  await expect(count).toHaveText("5 listas");
});

for (const width of [1280, 390]) {
  test(`outside click collapses search without clearing results or consuming playback at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 800 });
    await page.goto("/");
    await page
      .getByRole("button", { name: "Explore with sample audio" })
      .click();
    await expect(page.locator("#library-content .collection-count")).toHaveText(
      "8 songs",
    );
    await revealSearch(page);
    const input = page.getByRole("searchbox");
    await input.fill("rain");
    await expect(page.locator("#library-content .collection-count")).toHaveText(
      "1 of 8 songs",
    );
    if (width === 390) {
      const filter = page.getByRole("button", {
        name: "Filter and sort",
        exact: true,
      });
      await filter.click();
      await expect(input).toHaveCount(0);
      const anchor = await filter.boundingBox();
      const menu = await page.locator(".action-menu").boundingBox();
      expect(
        Math.abs(menu!.y - (anchor!.y + anchor!.height + 6)),
      ).toBeLessThanOrEqual(1);
      await page.keyboard.press("Escape");
      await expect(
        page.locator("#library-content .collection-count"),
      ).toHaveText("1 of 8 songs");
      await revealSearch(page);
    }
    await page.locator("#library-content .collection-count").click();
    await expect(input).toHaveCount(0);
    await expect(
      page.locator("#library-content .track-copy strong"),
    ).toHaveText(["Blue after rain"]);
    await expect(
      page.locator("[data-search-trigger] button").first(),
    ).toHaveAttribute("aria-pressed", "true");
    await revealSearch(page);
    await expect(input).toHaveValue("rain");
    await input.press("Tab");
    await expect(input).toBeVisible();
    await input.focus();
    await page
      .getByRole("button", { name: "Play Blue after rain", exact: true })
      .click();
    await expect(input).toHaveCount(0);
    await expect(page.locator(".mini-track strong")).toHaveText(
      "Blue after rain",
    );
    await expect(page.locator("#library-content .collection-count")).toHaveText(
      "1 of 8 songs",
    );
    await page.keyboard.press("Escape");
    await expect(page.locator("#library-content .collection-count")).toHaveText(
      "8 songs",
    );
    await expect(
      page.locator("[data-search-trigger] button").first(),
    ).not.toHaveAttribute("aria-pressed", "true");
    await revealSearch(page);
    await expect(input).toHaveValue("");
    await input.fill("no matching track here");
    await expect(page.locator("#library-content .search-empty")).toBeVisible();
    await page.locator("#library-content .search-empty h3").click();
    await expect(input).toHaveCount(0);
    await expect(page.locator("#library-content .collection-count")).toHaveText(
      "0 of 8 songs",
    );
    await page
      .locator("#library-content .search-empty")
      .getByRole("button", { name: "Clear search", exact: true })
      .click();
    await expect(page.locator("#library-content .collection-count")).toHaveText(
      "8 songs",
    );
  });
}

test("clearing survives immediate Library tab navigation without clearing newer typing", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Explore with sample audio" }).click();
  await revealSearch(page);
  const input = page.getByRole("searchbox");
  await input.fill("blue");
  await expect(page.locator("#library-content .track-row")).toHaveCount(4);
  await page.clock.install();
  await page.locator("#library-content .toolbar-actions [data-search-clear]").click();
  await page.getByRole("tab", { name: "Playlists", exact: true }).click();
  await page.clock.runFor(300);
  await expect(
    page.locator("#library-content .automatic-playlist-tile"),
  ).toHaveCount(4);
  await expect(
    page.locator("#library-content [data-search-clear]"),
  ).toHaveCount(0);

  await revealSearch(page);
  await input.fill("blue");
  await page.clock.runFor(300);
  await page.locator("#library-content .toolbar-actions [data-search-clear]").click();
  await input.fill("rain");
  await page.clock.runFor(300);
  await expect(input).toHaveValue("rain");
  await expect(page.locator("#library-content .collection-count")).toHaveText(
    "0 of 4 playlists",
  );
});

test("collapsed query has a reachable clear button without reopening the field", async ({
  page,
}) => {
  await seedInlineCatalog(page);
  const input = page.getByRole("searchbox");
  await revealSearch(page);
  await input.fill("Needle");
  await expect(page.locator("#library-content .collection-count")).toHaveText(
    "2 of 130 songs",
  );
  await expect(
    page.getByRole("button", { name: "Clear search", exact: true }),
  ).toHaveCount(1);
  await page.locator("#library-content .collection-count").click();
  for (const width of [1280, 390, 320]) {
    await page.setViewportSize({ width, height: 800 });
    const clear = page
      .locator("#library-content .toolbar-actions")
      .getByRole("button", { name: "Clear search", exact: true });
    await expect(clear).toBeInViewport();
    const box = await clear.boundingBox();
    expect(box!.width).toBeGreaterThanOrEqual(44);
    expect(box!.height).toBeGreaterThanOrEqual(44);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth - innerWidth,
      ),
    ).toBeLessThanOrEqual(1);
  }
  await page
    .locator("#library-content .toolbar-actions")
    .getByRole("button", { name: "Clear search", exact: true })
    .click();
  await expect(input).toHaveCount(0);
  await expect(page.locator("#library-content .collection-count")).toHaveText(
    "130 songs",
  );
  await expect(page.locator("[data-library-filters]")).toBeFocused();
});

test("search prioritizes primary names before pagination but preserves playlist order", async ({
  page,
}) => {
  await seedInlineCatalog(page);
  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve) => {
      const r = indexedDB.open("local-music-v1");
      r.onsuccess = () => resolve(r.result);
    });
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("tracks", "readwrite");
      const store = tx.objectStore("tracks");
      for (let i = 0; i < 130; i++) {
        const r = store.get(`entry-${i}`);
        r.onsuccess = () => {
          const t = r.result;
          t.title =
            i === 129
              ? "Rain"
              : i === 128
                ? "Rain falls"
                : i === 127
                  ? "After rain"
                  : `A metadata ${i}`;
          t.artist = `Rain person ${i}`;
          t.album = t.title;
          store.put(t, t.id);
        };
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  });
  await page.reload();
  await revealSearch(page);
  await page.getByRole("searchbox").fill("rain");
  await expect(
    page.locator("#library-content .track-copy strong").first(),
  ).toHaveText("Rain");
  await expect(
    page.locator("#library-content .track-copy strong").nth(1),
  ).toHaveText("Rain falls");
  await expect(
    page.locator("#library-content .track-copy strong").nth(2),
  ).toHaveText("After rain");
  await page.getByRole("tab", { name: "Albums", exact: true }).click();
  await expect(
    page.locator("#library-content .album-card strong").first(),
  ).toHaveText("Rain");
  await page.getByRole("tab", { name: "Playlists", exact: true }).click();
  await revealSearch(page);
  await page.getByRole("searchbox").fill("Needle");
  await page
    .getByRole("button", { name: /Needle playlist/ })
    .first()
    .click();
  await revealSearch(page);
  await page.getByRole("searchbox").fill("rain");
  await expect(page.locator("#library-content .track-copy strong")).toHaveText([
    "A metadata 0",
    "A metadata 1",
    "A metadata 2",
    "Rain",
  ]);
});

test("toolbar clear retains filtered rows through a cancellable reset and keeps search open", async ({
  page,
}) => {
  await seedInlineCatalog(page);
  await revealSearch(page);
  const input = page.getByRole("searchbox");
  await input.fill("Needle");
  await expect(page.locator("#library-content .collection-count")).toHaveText(
    "2 of 130 songs",
  );
  const clear = page.locator("#library-content [data-search-clear]");
  const filter = page.locator("[data-library-filters]");
  const a = await clear.boundingBox(),
    b = await filter.boundingBox();
  expect(a!.x + a!.width).toBeLessThanOrEqual(b!.x);
  expect(
    Math.abs(a!.y + a!.height / 2 - b!.y - b!.height / 2),
  ).toBeLessThanOrEqual(1);
  await expect(page.locator(".inline-search button")).toHaveCount(1);
  await page.clock.install({ time: new Date("2026-10-30T12:00:00Z") });
  await page.clock.pauseAt(new Date("2026-10-30T12:00:01Z"));
  await clear.click();
  const content = page.locator("#library-content");
  await expect(content).toHaveAttribute("data-search-reset", "out");
  await expect(page.locator("#library-content .track-copy strong")).toHaveText([
    "Needle first",
    "Needle last",
  ]);
  await page.clock.runFor(100);
  await expect(content).toHaveAttribute("data-search-reset", "in");
  await expect(page.locator("#library-content .collection-count")).toHaveText(
    "130 songs",
  );
  await expect(input).toBeVisible();
  await expect(input).toHaveValue("");
  await page.clock.runFor(170);
  await expect(input).toBeFocused();
  await expect(content).not.toHaveAttribute("data-search-reset");
  // A new edit during the exit must cancel the old clear, not erase the edit.
  await input.fill("Needle");
  await page.clock.runFor(200);
  await expect(page.locator("#library-content .collection-count")).toHaveText(
    "2 of 130 songs",
  );
  await clear.click();
  await input.fill("needle ");
  await page.clock.runFor(300);
  await expect(input).toHaveValue("needle ");
  await expect(content).not.toHaveAttribute("data-search-reset");
});

test("Reduce Motion clears immediately without dimming or changing Favorites", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await seedInlineCatalog(page);
  await page
    .getByRole("button", { name: "Filter and sort", exact: true })
    .click();
  await page
    .getByRole("menuitemradio", { name: "Favorites", exact: true })
    .click();
  await revealSearch(page);
  await page.getByRole("searchbox").fill("Needle");
  await expect(
    page.locator("#library-content .collection-count"),
  ).toContainText("1 of 1");
  await page.locator("#library-content .collection-count").click();
  await page.clock.install({ time: new Date("2026-10-30T12:00:00Z") });
  await page.clock.pauseAt(new Date("2026-10-30T12:00:01Z"));
  await page.locator("#library-content [data-search-clear]").click();
  await expect(page.locator("#library-content")).not.toHaveAttribute(
    "data-search-reset",
  );
  await expect(
    page.locator("#library-content .collection-count"),
  ).toContainText("Favorites");
  await expect(page.locator("#library-content .track-copy strong")).toHaveText([
    "Needle last",
  ]);
});
