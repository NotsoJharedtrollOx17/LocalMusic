import {
  test,
  expect,
  type Page,
  type CDPSession,
  type Locator,
} from "@playwright/test";
import { openSettings } from "./navigationHelpers";
import { wav } from "./fixtures";

test.use({ hasTouch: true });

test("phone Settings keeps its final navigation row above the system inset", async ({
  page,
}) => {
  await seed(page, 6);
  await page.evaluate(() => {
    document.documentElement.dataset.platform = "android";
    document.documentElement.style.setProperty(
      "--task-dialog-safe-bottom",
      "48px",
    );
  });
  const settings = await openSettings(page),
    about = settings.getByRole("button", {
      name: "About Local Music",
      exact: true,
    });
  await about.scrollIntoViewIfNeeded();
  const box = await about.boundingBox(),
    height = await page.evaluate(() => innerHeight);
  expect(box!.y + box!.height).toBeLessThanOrEqual(height - 48 + 1);
  await about.click();
  await expect(
    page.getByRole("dialog", { name: "About Local Music", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(settings).toBeVisible();
});
async function seed(page: Page, count = 70, es = false, allAudio = false) {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(
    page.getByRole("tab", { name: "Songs", exact: true }),
  ).toBeVisible();
  await page.evaluate(
    async ({ count, es, audio, allAudio }) => {
      const db = await new Promise<IDBDatabase>((resolve) => {
        const r = indexedDB.open("local-music-v1");
        r.onsuccess = () => resolve(r.result);
      });
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(
          ["tracks", "settings", "sessions", "intervals", "playlists"],
          "readwrite",
        );
        for (const name of ["tracks", "sessions", "intervals", "playlists"])
          tx.objectStore(name).clear();
        const now = Date.now(),
          start = new Date(now - 120000).toISOString();
        const file = new Blob([new Uint8Array(audio)], { type: "audio/wav" });
        tx.objectStore("settings").put(
          {
            language: es ? "es" : "en",
            theme: es ? "dark" : "light",
            timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            historyEnabledSince: new Date(now - 86400000).toISOString(),
            privacyRevision: 0,
          },
          "preferences",
        );
        for (let i = 0; i < count; i++) {
          const id = `phone-${i}`;
          tx.objectStore("tracks").put(
            {
              id,
              title: `Track ${String(i).padStart(3, "0")} with a longer song title`,
              artist: `Artist ${i % 2}`,
              album: `Album ${i % 3}`,
              genre: "Rock",
              durationMs: 243000,
              available: true,
              favorite: i % 2 === 0,
              file: i === 0 || allAudio ? file : new Blob(),
              sourceUri: `/fixtures/${id}`,
              identityMetadataRead: true,
              orderMetadataRead: true,
              releaseMetadataRead: true,
            },
            id,
          );
        }
        tx.objectStore("sessions").put(
          {
            id: "phone-session",
            trackId: "phone-0",
            startedAtUtc: start,
            playedMs: 60000,
            excluded: false,
          },
          "phone-session",
        );
        tx.objectStore("intervals").put(
          {
            sessionId: "phone-session",
            sequence: 0,
            startUtc: start,
            playedMs: 60000,
          },
          "phone-session:0",
        );
        tx.objectStore("playlists").put(
          {
            id: "phone-list",
            title: "My songs",
            kind: "manual",
            trackIds: ["phone-0", "phone-1"],
          },
          "phone-list",
        );
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
      db.close();
    },
    { count, es, allAudio, audio: Array.from(wav(12)) },
  );
  await page.reload();
  await expect(page.locator(".collection-count")).toContainText(String(count));
}
async function down(cdp: CDPSession, target: Locator) {
  const r = (await target.boundingBox())!;
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [
      { x: r.x + Math.min(r.width / 2, 60), y: r.y + r.height / 2 },
    ],
  });
}
async function up(cdp: CDPSession) {
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
}

test("phone text holds select once, Select all crosses pagination and filtered scope stays intact", async ({
  page,
  context,
}) => {
  await seed(page);
  const cdp = await context.newCDPSession(page),
    title = page.locator(".track-copy strong").first();
  // The first 60 loaded songs are virtualized; don't require hidden DOM rows.
  await expect(page.locator(".track-row").first()).toBeVisible();
  expect(await page.locator(".track-row").count()).toBeLessThan(60);
  await down(cdp, title);
  await expect(page.locator(".selection-heading")).toContainText("1 selected");
  await up(cdp);
  await expect(page.getByRole("menu")).toHaveCount(0);
  expect(await page.evaluate(() => window.getSelection()?.toString())).toBe("");
  await page.getByRole("button", { name: "Select all", exact: true }).click();
  await expect(page.locator(".selection-heading")).toContainText("70 selected");
  await expect(page.locator(".mini-player")).toHaveCount(0);
  await page.keyboard.press("Escape");
  const hit = page.locator(".track-hit").first();
  await hit.dispatchEvent("pointerdown", {
    isPrimary: true,
    pointerType: "touch",
    pointerId: 41,
    clientX: 100,
    clientY: 230,
  });
  await hit.evaluate((el) =>
    el.dispatchEvent(
      new PointerEvent("contextmenu", {
        bubbles: true,
        cancelable: true,
        pointerType: "touch",
      }),
    ),
  );
  await expect(page.locator(".selection-heading")).toContainText("1 selected");
  await hit.dispatchEvent("pointerup", { pointerType: "touch", pointerId: 41 });
  await hit.dispatchEvent("click", { detail: 1 });
  await hit.evaluate((el) =>
    el.dispatchEvent(
      new PointerEvent("contextmenu", {
        bubbles: true,
        cancelable: true,
        pointerType: "touch",
      }),
    ),
  );
  await expect(page.locator(".selection-heading")).toContainText("1 selected");
  await expect(page.getByRole("menu")).toHaveCount(0);
  await page.keyboard.press("Escape");
  await page
    .getByRole("button", { name: "Search your library", exact: true })
    .click();
  await page.getByRole("searchbox").fill("Track 069");
  await expect(page.locator(".track-row")).toHaveCount(1);
  await down(cdp, page.locator(".track-copy strong").first());
  await expect(page.locator(".selection-heading")).toContainText("1 selected");
  await up(cdp);
  await page.getByRole("button", { name: "Select all", exact: true }).click();
  await expect(page.locator(".selection-heading")).toContainText("1 selected");
  await page.screenshot({
    path: "artifacts/android-selection/selection-browser.png",
  });
});

test("phone duration, vertical overflow, single active tab and playlist spacing fit narrow rows", async ({
  page,
  context,
}) => {
  await seed(page, 6);
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 844 });
    const row = page.locator(".track-row").first();
    await expect(row.locator(":scope > .track-duration")).toBeHidden();
    await expect(row.locator(".track-duration-inline")).toHaveText("");
    await expect(row.locator(".track-duration-inline")).toBeHidden();
    await expect(row.locator(".overflow-vertical")).toBeVisible();
    await expect(row.locator(".overflow-horizontal")).toBeHidden();
    expect(
      (await row.locator(".track-hit").boundingBox())!.width,
    ).toBeGreaterThan(width - 155);
  }
  await page.getByRole("tab", { name: "Your Recap", exact: true }).click();
  const cdp = await context.newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: 40, y: 650 }],
  });
  for (let x = 80; x <= 280; x += 40)
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x, y: 650 }],
    });
  await up(cdp);
  const selected = page.getByRole("tab", { name: "Playlists", exact: true });
  await expect(selected).toHaveAttribute("aria-selected", "true");
  await expect(page.locator("[role=tab][aria-selected=true]")).toHaveCount(1);
  await expect
    .poll(async () => {
      const tab = (await selected.boundingBox())!,
        line = (await page.locator(".section-indicator").boundingBox())!;
      return Math.max(
        Math.abs(tab.x - line.x),
        Math.abs(tab.width - line.width),
      );
    })
    .toBeLessThan(1);
  const r = (await selected.boundingBox())!,
    indicator = (await page.locator(".section-indicator").boundingBox())!;
  expect(Math.abs(r.x - indicator.x)).toBeLessThan(1);
  expect(Math.abs(r.width - indicator.width)).toBeLessThan(1);
  await expect(
    page.getByRole("tab", { name: "Your Recap", exact: true }),
  ).toHaveCSS("font-weight", "400");
  expect(
    await page
      .locator(".saved-playlists")
      .evaluate((el) => parseFloat(getComputedStyle(el).paddingBottom)),
  ).toBeGreaterThanOrEqual(32);
});

test("phone icon backgrounds last only for the press while keyboard focus survives", async ({
  page,
  context,
}) => {
  await seed(page, 6);
  const cdp = await context.newCDPSession(page),
    button = page.getByRole("button", { name: "Library actions", exact: true });
  const original = await button.evaluate(
    (el) => getComputedStyle(el).backgroundColor,
  );
  await down(cdp, button);
  await expect(button).not.toHaveCSS("background-color", original);
  await up(cdp);
  await expect(button).toHaveCSS("background-color", original);
  await page.keyboard.press("Escape");
  const search = page.getByRole("button", {
    name: "Search your library",
    exact: true,
  });
  await down(cdp, search);
  await expect(search).not.toHaveCSS("background-color", original);
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchCancel",
    touchPoints: [],
  });
  await expect(search).toHaveCSS("background-color", original);
  await page.keyboard.press("Tab");
  expect(
    await page
      .locator(":focus")
      .evaluate((el) => getComputedStyle(el, "::before").content),
  ).not.toBe("none");
});

test("phone Settings hierarchy and organization browse-review flows work in EN/ES", async ({
  page,
}) => {
  for (const es of [false, true]) {
    await seed(page, 6, es);
    await page.setViewportSize({ width: 320, height: 640 });
    await page.evaluate(() => {
      document.documentElement.style.fontSize = "18.2px";
    });
    await openSettings(page);
    const settings = page.getByRole("dialog", {
      name: es ? "Ajustes" : "Settings",
      exact: true,
    });
    const sizes = await settings
      .locator("legend")
      .evaluateAll((els) => els.map((el) => getComputedStyle(el).fontSize));
    expect(new Set(sizes).size).toBe(1);
    await settings
      .getByRole("button", {
        name: es ? "Organizar biblioteca" : "Organize library",
        exact: true,
      })
      .click();
    const org = page.getByRole("dialog", {
      name: es ? "Organizar biblioteca" : "Organize library",
      exact: true,
    });
    const lead = es ? "Artista principal" : "Lead artist",
      edit = es ? "Editar" : "Edit";
    await expect(
      org.getByRole("textbox", { name: lead, exact: true }),
    ).toHaveCount(0);
    await org.getByRole("button", { name: edit, exact: true }).first().click();
    await expect(
      org.getByRole("textbox", { name: lead, exact: true }),
    ).toHaveCount(1);
    await expect(
      org.getByRole("textbox", { name: lead, exact: true }),
    ).toHaveCSS("user-select", "text");
    await org
      .getByRole("textbox", { name: lead, exact: true })
      .fill("Unsaved correction");
    await org
      .getByRole("button", { name: es ? "Cancelar" : "Cancel", exact: true })
      .click();
    await expect(
      org.getByRole("textbox", { name: lead, exact: true }),
    ).toHaveCount(0);
    for (const tab of [es ? "Canciones" : "Songs", es ? "Álbumes" : "Albums"]) {
      await org.getByRole("button", { name: tab, exact: true }).click();
      const choices = org.locator(".organization-choice");
      await choices.nth(0).getByRole("checkbox").check();
      await choices.nth(1).getByRole("checkbox").check();
      await expect(org.locator(".organization-selection")).toContainText("2");
      const review = org.getByRole("button", {
        name: es ? "Revisar selección" : "Review selection",
        exact: true,
      });
      await expect(review).toBeInViewport();
      await review.click();
      await expect(
        org.locator(".organization-workflow > .organization-review"),
      ).toBeVisible();
      await expect(org.locator(".organization-browse").first()).toBeHidden();
      expect(
        await org.evaluate((el) => el.scrollWidth - el.clientWidth),
      ).toBeLessThanOrEqual(1);
      await page.keyboard.press("Escape");
      await expect(org).toBeVisible();
      await expect(review).toBeFocused();
      await expect(choices.nth(0).getByRole("checkbox")).toBeChecked();
    }
    await page.screenshot({
      path: `artifacts/android-selection/organization-${es ? "es" : "en"}.png`,
    });
    await page.keyboard.press("Escape");
    await expect(settings).toBeVisible();
    const about = es ? "Acerca de Local Music" : "About Local Music";
    await settings.getByRole("button", { name: about, exact: true }).click();
    await page.keyboard.press("Escape");
    await expect(settings).toBeVisible();
    await page.keyboard.press("Escape");
  }
});

test("Recap keeps its disclaimer after Top 10 and phone player keeps only its accessible title", async ({
  page,
}) => {
  await seed(page, 6);
  await page.getByRole("tab", { name: "Your Recap", exact: true }).click();
  await expect(page.locator(".recap-total strong")).toHaveText("1");
  const list = page.locator(".recap-track-list"),
    note = page.locator(".recap-disclaimer");
  expect(
    await note.evaluate(
      (el) => !!el.previousElementSibling?.matches(".recap-track-list"),
    ),
  ).toBe(true);
  expect((await note.boundingBox())!.y).toBeGreaterThan(
    (await list.boundingBox())!.y,
  );
  await expect(page.locator(".recap-actions")).toHaveCSS("display", "flex");
  await page.getByRole("tab", { name: "Songs", exact: true }).click();
  await page.locator(".track-hit").first().click();
  await page
    .locator(".mobile-mini-play")
    .getByRole("button", { name: "Pause", exact: true })
    .click();
  await page.locator(".mini-track").click();
  const player = page.getByRole("dialog", { name: "Now playing", exact: true });
  await expect(player).toBeVisible();
  await expect(player.locator(".player-surface-head > h2")).toBeHidden();
});


test("short phone taps activate songs and collection cards without a hold", async ({ page, context }) => {
  await seed(page, 90);
  const cdp = await context.newCDPSession(page);
  const hit = page.locator(".track-hit").first();
  await down(cdp, hit); await up(cdp);
  await expect(page.locator(".track-row.is-playing")).toHaveCount(1);
  await expect(page.locator(".selection-toolbar")).toHaveCount(0);
  await down(cdp, hit); await up(cdp);
  await expect(page.locator(".track-row.is-playing")).toHaveCount(0);
  for (const kind of ["albums", "artists"]) {
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: 300, y: 450 }] });
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: 180, y: 450 }] });
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await expect(page.locator(`#tab-${kind}`)).toHaveAttribute("aria-selected", "true");
    const card = page.locator(`.catalog-${kind} .album-card`).first();
    await expect(card).toBeVisible();
    await down(cdp, card); await up(cdp);
    await expect(page.locator(".collection-hero")).toBeVisible();
    await expect(page.locator(".track-row").first()).toBeVisible();
    await page.locator(".group-back").click();
  }
});


test("consecutive phone song taps change tracks and toggle the current song", async ({ page, context }) => {
  await seed(page, 6, false, true);
  const cdp = await context.newCDPSession(page);
  for (const index of [0, 1, 2, 0]) {
    const row = page.locator('.track-row').nth(index);
    await down(cdp, row.locator('.track-hit')); await up(cdp);
    await expect(row).toHaveClass(/is-playing/);
    await down(cdp, row.locator('.track-hit')); await up(cdp);
    await expect(row).not.toHaveClass(/is-playing/);
    await expect(row).toHaveClass(/is-current/);
  }
});
