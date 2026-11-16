import { test, expect, type Page, type Locator } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { taggedWav } from "./fixtures";
import { openSettings, equalizerDialog } from "./navigationHelpers";

async function library(page: Page) {
  await page.goto("/");
  await page
    .locator('input[type="file"]')
    .first()
    .setInputFiles(
      Array.from({ length: 8 }, (_, index) => ({
        name: `Track ${index}.wav`,
        mimeType: "audio/wav",
        buffer: taggedWav(
          index === 0
            ? "A long song title from the midnight orchestra and its expanded concert edition"
            : `Track ${index}`,
          index + 1,
          40,
        ),
      })),
    );
  await expect(page.locator("#library-content .track-row")).toHaveCount(8);
}
async function player(page: Page) {
  await library(page);
  await page
    .locator("#library-content .track-row")
    .first()
    .getByRole("button", { name: /^Play / })
    .click();
  await page
    .locator(".mini-player")
    .getByRole("button", { name: "Pause", exact: true })
    .click();
  await page.locator(".mini-track").click();
  return page.getByRole("dialog", { name: "Now playing", exact: true });
}
async function settle(page: Page) {
  await page.evaluate(() =>
    Promise.all(
      document
        .getAnimations()
        .filter(
          (animation) =>
            animation.effect?.getComputedTiming().iterations !== Infinity,
        )
        .map((animation) => animation.finished.catch(() => {})),
    ),
  );
}
async function aligned(surface: Locator) {
  const metrics = await surface.evaluate((node) => {
    const box = (selector: string) =>
      node.querySelector<HTMLElement>(selector)!.getBoundingClientRect();
    const center = (rect: DOMRect) => rect.x + rect.width / 2;
    const root = node.getBoundingClientRect();
    const menu = box("[data-player-menu]");
    const title = node.querySelector<HTMLElement>(".player-surface-head h2")!;
    const visibleTitle = title.getClientRects().length > 0;
    return {
      centers: [
        ...(visibleTitle ? [center(title.getBoundingClientRect())] : []),
        center(box(".play-circle")),
        center(box(".progress input")),
        center(box(".player-track-actions")),
      ],
      center: center(root),
      menu: {
        width: menu.width,
        height: menu.height,
        centerY: menu.y + menu.height / 2,
      },
      // Phone Now Playing intentionally hides its visual title. Queue and
      // desktop headings remain visible; compare compact headers to Back.
      headerY: visibleTitle
        ? title.getBoundingClientRect().y +
          title.getBoundingClientRect().height / 2
        : box(".player-surface-head > button").y +
          box(".player-surface-head > button").height / 2,
      transportBottom: box(".transport").bottom,
      overflow: node.scrollWidth - node.clientWidth,
      viewportHeight: innerHeight,
      transport: [...node.querySelectorAll(".transport > button")].map(
        (button) => button.getAttribute("aria-label"),
      ),
      actionButtons: [
        ...node.querySelectorAll(".player-track-actions > button"),
      ].map((button) => {
        const r = button.getBoundingClientRect();
        return {
          width: r.width,
          height: r.height,
          centerY: r.y + r.height / 2,
        };
      }),
      rowOrder: [
        box(".player-track-actions").bottom,
        box(".progress").top,
        box(".progress").bottom,
        box(".transport").top,
      ],
    };
  });
  for (const center of metrics.centers)
    expect(Math.abs(center - metrics.center)).toBeLessThanOrEqual(1);
  expect(metrics.menu.width).toBeGreaterThanOrEqual(44);
  expect(metrics.menu.height).toBeGreaterThanOrEqual(44);
  expect(Math.abs(metrics.menu.centerY - metrics.headerY)).toBeLessThanOrEqual(
    1,
  );
  expect(metrics.transportBottom).toBeLessThanOrEqual(metrics.viewportHeight);
  expect(metrics.overflow).toBeLessThanOrEqual(1);
  expect(metrics.transport).toHaveLength(5);
  expect(metrics.actionButtons).toHaveLength(3);
  for (const button of metrics.actionButtons) {
    expect(button.width).toBeGreaterThanOrEqual(44);
    expect(button.height).toBeGreaterThanOrEqual(44);
    expect(
      Math.abs(button.centerY - metrics.actionButtons[0].centerY),
    ).toBeLessThanOrEqual(1);
  }
  expect(metrics.rowOrder[0]).toBeLessThanOrEqual(metrics.rowOrder[1] + 1);
  expect(metrics.rowOrder[2]).toBeLessThanOrEqual(metrics.rowOrder[3] + 1);
}

test("player and Queue keep a common centerline and balanced actions across languages and window sizes", async ({
  page,
}) => {
  test.setTimeout(120000);
  let surface = await player(page);
  for (const language of ["en", "es"]) {
    if (language === "es") {
      await page.keyboard.press("Escape");
      const settings = await openSettings(page);
      await settings
        .getByRole("button", { name: "Español", exact: true })
        .click();
      await settings
        .getByRole("button", { name: "Oscuro", exact: true })
        .click();
      await page.keyboard.press("Escape");
      await page.locator(".mini-track").click();
    }
    for (const size of [
      { width: 1280, height: 900 },
      { width: 640, height: 420 },
      { width: 390, height: 844 },
      { width: 320, height: 568 },
    ]) {
      await page.setViewportSize(size);
      await settle(page);
      surface = page.getByRole("dialog", {
        name: language === "en" ? "Now playing" : "Reproduciendo",
        exact: true,
      });
      await aligned(surface);
      await expect(surface.locator(".player-options")).toHaveCount(0);
      const options = surface.getByRole("button", {
        name: language === "en" ? "Player options" : "Opciones del reproductor",
        exact: true,
      });
      await options.click();
      await expect(
        page.getByRole("menuitemcheckbox", {
          name:
            language === "en" ? "Exclude from recap" : "Excluir del resumen",
          exact: true,
        }),
      ).toBeVisible();
      await expect(
        page.getByRole("menuitem", {
          name: language === "en" ? "Equalizer" : "Ecualizador",
          exact: true,
        }),
      ).toBeVisible();
      await expect(
        page.getByRole("menu").locator('[role^="menuitem"]'),
      ).toHaveText(
        language === "en"
          ? [
              "Track details",
              "Go to album",
              "Go to artist",
              "Suggest less",
              "Equalizer",
              "Visualizer",
              "Exclude from recap",
              "Remove from Library",
            ]
          : [
              "Detalles de la canción",
              "Ir al álbum",
              "Ir al artista",
              "Sugerir menos",
              "Ecualizador",
              "Visualizador",
              "Excluir del resumen",
              "Quitar de la biblioteca",
            ],
      );
      await page.keyboard.press("Escape");
      await expect(options).toBeFocused();
      expect(
        await surface
          .locator(".player-track-actions > button")
          .evaluateAll((nodes) =>
            nodes.map((node) => node.getAttribute("aria-label")),
          ),
      ).toEqual(
        language === "en"
          ? ["Queue", "Favorite", "Add to playlist"]
          : ["Cola", "Favorita", "Añadir a una lista"],
      );
      await expect(surface.locator(".player-title button")).toHaveCount(0);
      await expect(surface.locator(".player-surface-head button")).toHaveCount(
        2,
      );
      await surface
        .locator(".player-track-actions")
        .getByRole("button", {
          name: language === "en" ? "Queue" : "Cola",
          exact: true,
        })
        .click();
      const queue = page.getByRole("dialog", {
        name: language === "en" ? "Queue" : "Cola",
        exact: true,
      });
      await settle(page);
      await aligned(queue);
      const columns = await queue
        .locator(".row-actions")
        .first()
        .locator("button")
        .evaluateAll((nodes) =>
          nodes.map((node) => node.getBoundingClientRect().width),
        );
      expect(columns).toEqual(Array(3).fill(size.width <= 760 ? 48 : 44));
      expect(
        await queue
          .locator(".player-surface-body")
          .evaluate((node) => getComputedStyle(node).scrollbarGutter),
      ).toBe("stable both-edges");
      await page.screenshot({
        path: `artifacts/menu-layout/queue-${language}-${size.width}-${size.height}.png`,
      });
      await page.keyboard.press("Escape");
      await settle(page);
      await page.screenshot({
        path: `artifacts/menu-layout/player-${language}-${size.width}-${size.height}.png`,
      });
    }
  }
  await page.emulateMedia({ reducedMotion: "reduce" });
  await aligned(surface);
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
});

test("player plus targets the current song and returns focus after playlist cancellation and save", async ({
  page,
}) => {
  const surface = await player(page);
  const plus = surface.getByRole("button", {
    name: "Add to playlist",
    exact: true,
  });
  await plus.click();
  await expect(page.getByRole("dialog")).toHaveCount(1);
  await expect(page.locator(".player-scrim")).toBeHidden();
  await page.keyboard.press("Escape");
  await expect(plus).toBeFocused();
  await plus.click();
  await page.getByRole("button", { name: "New playlist", exact: true }).click();
  await page
    .getByLabel("Playlist name", { exact: true })
    .fill("Current song collection");
  await expect(page.getByRole("checkbox", { checked: true })).toHaveCount(1);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(1);
  await expect(page.locator(".playlist-destinations")).toBeVisible();
  await page
    .getByRole("button", { name: "Current song collection", exact: true })
    .click();
  await expect(surface).toBeVisible();
  await expect(plus).toBeFocused();
  await page.keyboard.press("Escape");
  await page.getByRole("tab", { name: "Playlists", exact: true }).click();
  await page
    .locator(".playlist-tile")
    .filter({ hasText: "Current song collection" })
    .click();
  await expect(page.locator("#library-content .track-row")).toHaveCount(1);
  await expect(page.locator("#library-content .track-row strong")).toHaveText(
    "A long song title from the midnight orchestra and its expanded concert edition",
  );
});

test("privacy pending and failure states recover while menus and queue actions retain their behavior", async ({
  page,
}) => {
  const surface = await player(page);
  const favorite = surface
    .locator(".player-track-actions")
    .getByRole("button", { name: "Favorite", exact: true });
  await expect(favorite).toHaveAttribute("aria-pressed", "false");
  await favorite.click();
  await expect(favorite).toHaveAttribute("aria-pressed", "true");
  const actions = surface.getByRole("button", {
    name: "Player options",
    exact: true,
  });
  await actions.click();
  const privacy = page.getByRole("menuitemcheckbox", {
    name: "Exclude from recap",
    exact: true,
  });
  await page.evaluate(() => {
    const original = IDBObjectStore.prototype.get;
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    (window as any).releasePrivacy = release;
    IDBObjectStore.prototype.get = function (...args) {
      const request = original.apply(this, args);
      if (
        this.name === "tracks" &&
        this.transaction.objectStoreNames.length === 1
      ) {
        IDBObjectStore.prototype.get = original;
        request.addEventListener(
          "success",
          (event) => {
            event.stopImmediatePropagation();
            void gate.then(() => request.onsuccess?.call(request, event));
          },
          { once: true },
        );
      }
      return request;
    };
    document.querySelector<HTMLButtonElement>('.action-menu [role="menuitemcheckbox"]')!.click();
  });
  await expect(privacy).toHaveAttribute("aria-checked", "true");
  await expect(privacy).toBeDisabled();
  await expect(privacy).toHaveAttribute("aria-busy", "true");
  await page.keyboard.press("Escape");
  await expect(actions).toBeFocused();
  await actions.click();
  await expect(privacy).toHaveAttribute("aria-checked", "true");
  await expect(privacy).toBeDisabled();
  await page.evaluate(() => (window as any).releasePrivacy());
  await expect(privacy).toBeEnabled();
  await expect(privacy).not.toHaveAttribute("aria-busy", "true");
  await page.evaluate(() => {
    const original = IDBObjectStore.prototype.get;
    IDBObjectStore.prototype.get = function (...args) {
      if (
        this.name === "tracks" &&
        this.transaction.objectStoreNames.length === 1
      ) {
        IDBObjectStore.prototype.get = original;
        throw new Error("Privacy fixture read failed");
      }
      return original.apply(this, args);
    };
    // Dispatch in the injection task so a playback poll cannot consume the
    // one-shot failure between two automation calls.
    document
      .querySelector<HTMLButtonElement>(
        '.action-menu [role="menuitemcheckbox"]',
      )!
      .click();
  });
  await expect(page.getByRole("alert")).toContainText(
    "Privacy fixture read failed",
  );
  await expect(privacy).toHaveAttribute("aria-checked", "true");
  await expect(privacy).toBeEnabled();
  await privacy.click();
  await expect(privacy).toHaveAttribute("aria-checked", "false");
  await expect(privacy).toBeEnabled();
  await privacy.focus();
  await page.keyboard.press("Space");
  await expect(privacy).toHaveAttribute("aria-checked", "true");
  await expect(privacy).toBeEnabled();
  await page.keyboard.press("Space");
  await expect(privacy).toHaveAttribute("aria-checked", "false");
  await expect(privacy).toBeEnabled();
  await page.keyboard.press("Escape");
  await actions.click();
  await expect(actions).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByRole("menu")).toHaveCount(1);
  await page.keyboard.press("Escape");
  await expect(actions).toBeFocused();
  await expect(actions).toHaveAttribute("aria-expanded", "false");
  await actions.click();
  await page.getByRole("menuitem", { name: "Equalizer", exact: true }).click();
  await equalizerDialog(page);
  await expect(page.locator(".player-scrim")).toBeHidden();
  await expect(page.getByRole("dialog")).toHaveCount(1);
  await page.keyboard.press("Escape");
  await expect(actions).toBeFocused();
  await surface.getByRole("button", { name: "Queue", exact: true }).click();
  const queue = page.getByRole("dialog", { name: "Queue", exact: true });
  const rows = queue.locator(".track-row");
  await expect(
    rows.first().getByRole("button", { name: "Move up", exact: true }),
  ).toBeDisabled();
  await expect(
    rows.first().getByRole("button", { name: "Remove", exact: true }),
  ).toBeDisabled();
  await expect(
    rows.last().getByRole("button", { name: "Move down", exact: true }),
  ).toBeDisabled();
  const second = await rows.nth(1).locator("strong").textContent();
  await rows
    .nth(1)
    .getByRole("button", { name: "Move up", exact: true })
    .click();
  await expect(rows.first().locator("strong")).toHaveText(second!);
  await rows
    .last()
    .getByRole("button", { name: "Remove", exact: true })
    .click();
  await expect(rows).toHaveCount(7);
  await expect(
    queue
      .locator(".player-track-actions")
      .getByRole("button", { name: "Favorite", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await queue.getByRole("button", { name: "Now playing", exact: true }).click();
  await expect(favorite).toHaveAttribute("aria-pressed", "true");
  await favorite.click();
  await expect(favorite).toHaveAttribute("aria-pressed", "false");
});

test("playlist headings share the creation toolbar and detail metadata wraps without competing actions", async ({
  page,
}) => {
  await library(page);
  for (const language of ["en", "es"]) {
    if (language === "es") {
      const settings = await openSettings(page);
      await settings
        .getByRole("button", { name: "Español", exact: true })
        .click();
      await page.keyboard.press("Escape");
    }
    await page
      .getByRole("tab", {
        name: language === "en" ? "Playlists" : "Listas",
        exact: true,
      })
      .click();
    const heading = page.locator("#automatic-playlists-heading");
    await expect(heading).toHaveText(
      language === "en" ? "4 playlists" : "5 listas",
    );
    await expect(page.locator(".automatic-playlists > h3")).toHaveCount(0);
    const create = page.locator(".playlist-toolbar button");
    for (const width of [1280, 640, 600, 390, 320]) {
      await page.setViewportSize({ width, height: 844 });
      await settle(page);
      const h = (await heading.boundingBox())!,
        b = (await create.boundingBox())!;
      expect(
        Math.abs(h.y + h.height / 2 - b.y - b.height / 2),
      ).toBeLessThanOrEqual(1);
      if (width <= 760) {
        expect(b.width).toBeLessThan(
          (await page.locator(".playlist-toolbar").boundingBox())!.width * 0.65,
        );
        expect(b.height).toBeGreaterThanOrEqual(48);
      }
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBeLessThanOrEqual(width);
      await page.screenshot({
        path: `artifacts/menu-layout/playlists-${language}-${width}.png`,
      });
    }
    await create.click();
    await expect(page.getByRole("dialog")).toHaveCount(1);
    const manual = page.getByRole("dialog");
    const title = `An evening of music with the midnight orchestra — ${language}`;
    await manual
      .getByLabel(language === "en" ? "Playlist name" : "Nombre de la lista", {
        exact: true,
      })
      .fill(title);
    await manual.getByRole("checkbox").first().check();
    await manual
      .getByRole("button", {
        name: language === "en" ? "Save" : "Guardar",
        exact: true,
      })
      .click();
    await page
      .locator(".saved-playlists .playlist-tile")
      .filter({ hasText: title })
      .click();
    await expect(page.locator(".playlist-toolbar h2")).toHaveCount(1);
    await expect(page.locator(".playlist-toolbar h2")).toHaveText(title);
    const meta = (await page.locator(".playlist-detail-meta").boundingBox())!;
    const back = page.locator(".playlist-detail-head button").first();
    const backBox = (await back.boundingBox())!;
    expect(meta.y).toBeGreaterThanOrEqual(backBox.y + backBox.height);
    const edit = page.getByRole("button", {
      name: language === "en" ? "Edit playlist" : "Editar lista",
      exact: true,
    });
    const editBox = (await edit.boundingBox())!;
    expect(
      Math.abs(editBox.y + editBox.height / 2 - backBox.y - backBox.height / 2),
    ).toBeLessThanOrEqual(1);
    await edit.click();
    await page
      .getByRole("button", {
        name: language === "en" ? "Save playlist" : "Guardar lista",
        exact: true,
      })
      .click();
    await page.screenshot({
      path: `artifacts/menu-layout/playlist-detail-${language}-320.png`,
    });
    await back.click();
    await page
      .getByRole("tab", {
        name: language === "en" ? "Songs" : "Canciones",
        exact: true,
      })
      .click();
  }
});
