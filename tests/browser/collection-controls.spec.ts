import { test, expect } from "@playwright/test";
import { openSettings, openSound, closeSound } from "./navigationHelpers";

test("Lists uses the shared creation toolbar without a repeated title", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Explore with sample audio" }).click();
  const imported = await page.locator(".library-import").boundingBox();
  await page.getByRole("tab", { name: "Playlists", exact: true }).click();
  await page
    .locator("#library-content")
    .evaluate((el) =>
      Promise.all(
        el
          .getAnimations()
          .map((animation) => animation.finished.catch(() => {})),
      ),
    );
  await expect(
    page.getByRole("heading", { name: "Playlists", exact: true }),
  ).toHaveCount(0);
  const button = page.getByRole("button", {
    name: "New playlist",
    exact: true,
  });
  await expect(button).toHaveClass(/primary/);
  const created = (await button.boundingBox())!;
  expect(created.height).toBeCloseTo(imported!.height, 0);
  expect(created.x + created.width).toBeCloseTo(
    imported!.x + imported!.width,
    0,
  );
  expect(created.y + created.height / 2).toBeCloseTo(
    imported!.y + imported!.height / 2,
    0,
  );
  await button.click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await page.screenshot({ path: "artifacts/lists-toolbar-desktop.png" });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(button).toBeInViewport();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
  await page.screenshot({ path: "artifacts/lists-toolbar-mobile.png" });
});

test("song filtering and sorting return without duplicating Edit", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Explore with sample audio" }).click();
  await expect(page.locator(".track-row")).toHaveCount(8);
  const favoriteCount =
    (await page
      .locator('.track-row button[aria-label="Favorite"][aria-pressed="true"]')
      .count()) + 1;
  await page
    .locator(".track-row")
    .first()
    .getByRole("button", { name: "Favorite", exact: true })
    .click();
  const filter = page.getByRole("button", {
    name: "Filter and sort",
    exact: true,
  });
  await filter.click();
  const menu = page.getByRole("menu", { name: "Filter and sort", exact: true });
  await expect(menu.getByRole("menuitem")).toHaveCount(0);
  await expect(menu.getByRole("menuitemradio")).toHaveText([
    "Favorites",
    "Sort by title",
    "Sort by artist",
    "Sort by album",
  ]);
  await expect(menu.getByRole("menuitem", { name: /Edit|Select/ })).toHaveCount(
    0,
  );
  await menu
    .getByRole("menuitemradio", { name: "Favorites", exact: true })
    .click();
  await expect(page.locator(".track-row")).toHaveCount(favoriteCount);
  await expect(
    page.getByText(`${favoriteCount} songs`, { exact: true }),
  ).toBeVisible();
  await filter.click();
  await menu
    .getByRole("menuitemradio", { name: "Sort by title", exact: true })
    .click();
  await expect(page.locator(".track-row")).toHaveCount(8);
  for (const name of ["Sort by artist", "Sort by album", "Sort by title"]) {
    await filter.click();
    await menu.getByRole("menuitemradio", { name, exact: true }).click();
    const field =
      name === "Sort by title"
        ? ".track-copy strong"
        : name === "Sort by artist"
          ? ".track-copy > span:not(.album-label)"
          : ".album-label";
    const values = (
      await page.locator(".library-page " + field).allTextContents()
    ).map((s) => s.trim());
    expect(values).toEqual([...values].sort((a, b) => a.localeCompare(b)));
    await filter.click();
    await expect(
      menu.getByRole("menuitemradio", { name, exact: true }),
    ).toHaveAttribute("aria-checked", "true");
    await page.keyboard.press("Escape");
  }
  await page
    .getByRole("button", { name: "Library actions", exact: true })
    .click();
  await expect(page.getByRole("menuitem")).toHaveText([
    "Edit",
    "Sound options",
    "Settings",
  ]);
  await page.keyboard.press("Escape");
});

test("compact transport and actions share an axis and sound has no Resume button", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Explore with sample audio" }).click();
  await page
    .locator(".track-row")
    .first()
    .getByRole("button", { name: /^Play / })
    .click();
  await page
    .locator(".mini-center")
    .getByRole("button", { name: "Pause", exact: true })
    .click();
  for (const width of [900, 1280, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    const footer = (await page.locator(".mini-player").boundingBox())!;
    const transport = (await page
      .locator(".mini-center .transport")
      .boundingBox())!;
    const progress = (await page
      .locator(".mini-center .progress")
      .boundingBox())!;
    const play = (await page
      .locator(".mini-center")
      .getByRole("button", { name: "Play", exact: true })
      .boundingBox())!;
    const actions = (await page.locator(".mini-actions").boundingBox())!;
    expect(transport.x + transport.width / 2).toBeCloseTo(
      footer.x + footer.width / 2,
      0,
    );
    expect(progress.x + progress.width / 2).toBeCloseTo(
      footer.x + footer.width / 2,
      0,
    );
    expect(play.y + play.height / 2).toBeCloseTo(
      actions.y + actions.height / 2,
      0,
    );
    await page.screenshot({ path: `artifacts/player-centered-${width}.png` });
  }
  const eq = await openSound(page);
  await expect(
    eq.getByRole("button", { name: "Resume music", exact: true }),
  ).toHaveCount(0);
  await eq.getByRole("button", { name: "Rock", exact: true }).click();
  await closeSound(page);
  const adapt = await openSound(page, "adapt");
  await expect(
    adapt.getByRole("button", { name: "Resume music", exact: true }),
  ).toHaveCount(0);
  await closeSound(page);
  const settings = await openSettings(page);
  await expect(settings).toContainText(
    "Listening history powers Your Year, Recently played, and Most played.",
  );
});
