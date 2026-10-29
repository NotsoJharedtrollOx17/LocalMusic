import { test, expect, type Page } from "@playwright/test";
import { taggedWav } from "./fixtures";
import { holdNextTrackRead, release } from "./catalog-gate";
import { openSettings } from "./navigationHelpers";

async function importLibrary(page: Page) {
  await page.goto("/");
  await expect(page.locator(".empty-library")).toBeVisible();
  await page
    .locator("input[type=file]")
    .first()
    .setInputFiles(
      ["Alpha", "Beta", "Gamma"].map((title, i) => ({
        name: title + ".wav",
        mimeType: "audio/wav",
        buffer: taggedWav(title, i + 1),
      })),
    );
  await expect(page.locator(".track-row")).toHaveCount(3);
  await expect(page.locator(".library-toolbar")).toContainText("3 songs");
}

async function choose(page: Page, name: string) {
  await page
    .getByRole("button", { name: "Filter and sort", exact: true })
    .click();
  await page
    .getByRole("menu", { name: "Filter and sort" })
    .getByRole("menuitemradio", { name, exact: true })
    .click();
}

async function watchWrongEmptyStates(page: Page) {
  await page.evaluate(() => {
    const state = window as unknown as { wrongEmptyStates: string[] };
    state.wrongEmptyStates = [];
    new MutationObserver(() => {
      if (document.querySelector(".empty-library"))
        state.wrongEmptyStates.push("import");
      if (
        Array.from(document.querySelectorAll(".empty-small h3")).some(
          (node) => node.textContent === "No music found",
        )
      )
        state.wrongEmptyStates.push("search");
    }).observe(document.body, {
      subtree: true,
      childList: true,
      characterData: true,
    });
  });
}

test("empty Favorites stays scoped through delayed sorting and collection navigation", async ({
  page,
}) => {
  await importLibrary(page);
  await watchWrongEmptyStates(page);
  await holdNextTrackRead(page);
  await choose(page, "Favorites");
  await expect(page.locator(".catalog-loading")).toBeVisible();
  await expect(page.locator(".empty-favorites")).toHaveCount(0);
  await page.waitForFunction(
    () => (window as unknown as { catalogReadHeld: boolean }).catalogReadHeld,
  );
  await release(page);
  await expect(page.locator(".empty-favorites")).toContainText(
    "No favorite songs yet",
  );
  await expect(page.locator(".library-toolbar")).toContainText("0 songs");
  for (const name of ["Sort by artist", "Sort by album", "Sort by title"]) {
    await holdNextTrackRead(page);
    await choose(page, name);
    await expect(page.locator(".catalog-loading")).toBeVisible();
    await page.waitForFunction(
      () => (window as unknown as { catalogReadHeld: boolean }).catalogReadHeld,
    );
    await release(page);
    await expect(page.locator(".track-row")).toHaveCount(3);
    await expect(page.locator(".empty-favorites")).toHaveCount(0);
    await expect(page.locator(".collection-count")).toHaveText("3 songs");
    await expect(page.locator(".library-toolbar")).toContainText("3 songs");
    await choose(page, "Favorites");
    await expect(page.locator(".empty-favorites")).toBeVisible();
  }
  await page.screenshot({
    path: "artifacts/favorites-filter-review/empty-favorites-en.png",
  });

  // A stale Favorites request must not hide collections or replace All music.
  await holdNextTrackRead(page);
  await choose(page, "Sort by artist");
  await expect(page.locator(".catalog-loading")).toBeVisible();
  await page.waitForFunction(
    () => (window as unknown as { catalogReadHeld: boolean }).catalogReadHeld,
  );
  await page.getByRole("tab", { name: "Albums", exact: true }).click();
  await expect(page.locator(".album-card")).toHaveCount(1);
  await expect(page.locator(".collection-count")).toHaveText("1 album");
  await page.locator(".album-card").click();
  await expect(page.locator(".track-row")).toHaveCount(3);
  await page.getByRole("button", { name: "Library", exact: true }).click();
  await page.getByRole("tab", { name: "Artists", exact: true }).click();
  await expect(page.locator(".album-card")).toHaveCount(1);
  await page.getByRole("tab", { name: "Playlists", exact: true }).click();
  await expect(page.locator('.generator button[type="submit"]')).toBeEnabled();
  await release(page);
  await page.getByRole("tab", { name: "Songs", exact: true }).click();
  await expect(page.locator(".track-row")).toHaveCount(3);
  await expect(page.locator(".library-toolbar")).toContainText("3 songs");
  expect(
    await page.evaluate(
      () =>
        (window as unknown as { wrongEmptyStates: string[] }).wrongEmptyStates,
    ),
  ).toEqual([]);
});

test("Favorites has its own empty state even before the first import", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator(".empty-library")).toBeVisible();
  await choose(page, "Favorites");
  await expect(page.locator(".empty-favorites")).toContainText(
    "No favorite songs yet",
  );
  await expect(page.locator(".library-toolbar")).toContainText("0 songs");
  await expect(page.locator(".empty-library")).toHaveCount(0);
  await choose(page, "Sort by title");
  await expect(page.locator(".empty-library")).toBeVisible();
  await expect(page.locator(".empty-favorites")).toHaveCount(0);
});

test("Favorites keeps its label, exclusive selection and opening focus after sorting", async ({
  page,
}) => {
  await importLibrary(page);
  for (const language of ["en", "es"]) {
    if (language === "es") {
      const settings = await openSettings(page);
      await settings
        .getByRole("button", { name: "Español", exact: true })
        .click();
      await page.keyboard.press("Escape");
      await page.setViewportSize({ width: 390, height: 844 });
    }
    const filter = page.getByRole("button", {
      name: language === "en" ? "Filter and sort" : "Filtrar y ordenar",
      exact: true,
    });
    const favorites = language === "en" ? "Favorites" : "Favoritas";
    const artist = language === "en" ? "Sort by artist" : "Ordenar por artista";
    const title = language === "en" ? "Sort by title" : "Ordenar por título";
    const menu = page.getByRole("menu");
    const favoriteOption = menu.getByRole("menuitemradio", {
      name: favorites,
      exact: true,
    });
    await filter.click();
    await menu
      .getByRole("menuitemradio", { name: artist, exact: true })
      .click();
    await expect(page.locator(".track-row")).toHaveCount(3);
    await filter.click();
    await expect(
      menu.getByRole("menuitemradio", { name: artist, exact: true }),
    ).toBeFocused();
    await favoriteOption.click();
    await expect(page.locator(".empty-favorites")).toBeVisible();
    for (let reopen = 0; reopen < 2; reopen++) {
      await filter.click();
      await expect(favoriteOption).toHaveAttribute("aria-checked", "true");
      await expect(favoriteOption).toBeFocused();
      await expect(menu.locator('[aria-checked="true"]')).toHaveCount(1);
      await expect(
        menu.getByText(language === "en" ? "All music" : "Toda la música", {
          exact: true,
        }),
      ).toHaveCount(0);
      await page.keyboard.press("Enter");
      await expect(page.locator(".empty-favorites")).toBeVisible();
      await expect(filter).toBeFocused();
    }
    await filter.click();
    await page.keyboard.press("ArrowDown");
    await expect(
      menu.getByRole("menuitemradio", { name: title, exact: true }),
    ).toBeFocused();
    await expect(favoriteOption).toHaveAttribute("aria-checked", "true");
    await page.keyboard.press("Escape");
    await expect(filter).toBeFocused();
    await filter.click();
    await expect(favoriteOption).toBeFocused();
    await menu.getByRole("menuitemradio", { name: title, exact: true }).click();
    await expect(page.locator(".track-row")).toHaveCount(3);
    await filter.click();
    await expect(favoriteOption).toHaveAttribute("aria-checked", "false");
    await expect(
      menu.getByRole("menuitemradio", { name: title, exact: true }),
    ).toBeFocused();
    await expect(menu.locator('[aria-checked="true"]')).toHaveCount(1);
    await page.screenshot({
      path: `artifacts/favorites-scope-review/menu-selection-${language}.png`,
    });
    await page.keyboard.press("Escape");
  }
});

test("Favorites recovers after a failed read and after removing its last song", async ({
  page,
}) => {
  await importLibrary(page);
  await watchWrongEmptyStates(page);
  await page.evaluate(() => {
    const original = IDBObjectStore.prototype.get;
    IDBObjectStore.prototype.get = function (...args) {
      if (
        this.name === "settings" &&
        args[0] === "catalog-revision" &&
        this.transaction.mode === "readonly"
      ) {
        IDBObjectStore.prototype.get = original;
        throw new Error("Deliberate catalog read failure");
      }
      return original.apply(this, args);
    };
  });
  await choose(page, "Favorites");
  await expect(page.locator(".library-toolbar")).not.toContainText("3 songs");
  await page
    .locator("#library-content")
    .getByRole("button", { name: "Try again", exact: true })
    .click();
  await expect(page.locator(".empty-favorites")).toBeVisible();
  await page
    .locator(".empty-favorites")
    .getByRole("button", { name: "All music", exact: true })
    .click();
  await expect(page.locator(".track-row")).toHaveCount(3);
  await page
    .locator(".track-row")
    .first()
    .getByRole("button", { name: "Favorite", exact: true })
    .click();
  await choose(page, "Favorites");
  await expect(page.locator(".track-row")).toHaveCount(1);
  await expect(page.locator(".library-toolbar")).toContainText("1 song");
  await page
    .locator(".track-row")
    .getByRole("button", { name: "Favorite", exact: true })
    .click();
  await expect(page.locator(".empty-favorites")).toBeVisible();
  await expect(page.locator(".library-toolbar")).toContainText("0 songs");
  expect(
    await page.evaluate(
      () =>
        (window as unknown as { wrongEmptyStates: string[] }).wrongEmptyStates,
    ),
  ).toEqual([]);

  const settings = await openSettings(page);
  await settings.getByRole("button", { name: "Español", exact: true }).click();
  await page.keyboard.press("Escape");
  await expect(page.locator(".empty-favorites")).toContainText(
    "Aún no tienes canciones favoritas",
  );
  await expect(page.locator(".library-toolbar")).toContainText("0 canciones");
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator(".empty-favorites button")).toBeInViewport();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
  await page.screenshot({
    path: "artifacts/favorites-filter-review/empty-favorites-es-mobile.png",
  });
});
