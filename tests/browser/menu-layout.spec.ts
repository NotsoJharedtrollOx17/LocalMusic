import { test, expect, type Page, type Locator } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { taggedWav } from "./fixtures";
import { openSettings, chooseSound } from "./navigationHelpers";

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
  await expect(page.locator(".track-row")).toHaveCount(8);
}
async function player(page: Page) {
  await library(page);
  await page
    .locator(".track-row")
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
    const options = [
      ...node.querySelectorAll<HTMLElement>(".player-option"),
    ].map((option) => {
      const rect = option.getBoundingClientRect();
      return {
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
        bottom: rect.bottom,
        iconY: option.querySelector("svg")!.getBoundingClientRect().y,
        clipped: option.scrollWidth > option.clientWidth + 1,
      };
    });
    return {
      centers: [
        center(box(".player-surface-head h2")),
        center(box(".play-circle")),
        center(box(".progress input")),
        center(box(".player-options")),
      ],
      center: center(root),
      options,
      overflow: node.scrollWidth - node.clientWidth,
      viewportHeight: innerHeight,
      transport: [...node.querySelectorAll(".transport > button")].map(
        (button) => button.getAttribute("aria-label"),
      ),
    };
  });
  for (const center of metrics.centers)
    expect(Math.abs(center - metrics.center)).toBeLessThanOrEqual(1);
  expect(metrics.options).toHaveLength(3);
  for (const option of metrics.options) {
    expect(
      Math.abs(option.width - metrics.options[0].width),
    ).toBeLessThanOrEqual(1);
    expect(
      Math.abs(option.height - metrics.options[0].height),
    ).toBeLessThanOrEqual(1);
    expect(
      Math.abs(option.iconY - metrics.options[0].iconY),
    ).toBeLessThanOrEqual(1);
    expect(option.width).toBeGreaterThanOrEqual(44);
    expect(option.height).toBeGreaterThanOrEqual(44);
    expect(option.bottom).toBeLessThanOrEqual(metrics.viewportHeight + 1);
    expect(option.clipped).toBe(false);
  }
  expect(metrics.overflow).toBeLessThanOrEqual(1);
  expect(metrics.transport).toHaveLength(5);
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
      const labels = await surface
        .locator(".player-option > span")
        .allTextContents();
      expect(labels).toEqual(
        language === "en"
          ? ["Sound options", "Track actions", "Exclude from recap"]
          : [
              "Opciones de sonido",
              "Acciones de la canción",
              "Excluir del resumen",
            ],
      );
      await surface
        .locator(".player-surface-head")
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
      expect(columns).toEqual([44, 44, 44]);
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

test("privacy pending and failure states recover while menus and queue actions retain their behavior", async ({
  page,
}) => {
  const surface = await player(page);
  const privacy = surface.getByRole("checkbox", {
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
      if (this.name === "tracks") {
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
  });
  await privacy.check();
  await expect(privacy).toBeChecked();
  await expect(privacy).toBeDisabled();
  await expect(surface.locator(".player-privacy")).toHaveAttribute(
    "aria-busy",
    "true",
  );
  await page.evaluate(() => (window as any).releasePrivacy());
  await expect(privacy).toBeEnabled();
  await expect(surface.locator(".player-privacy")).toHaveAttribute(
    "data-checked",
    "true",
  );
  await page.evaluate(() => {
    const original = IDBObjectStore.prototype.get;
    IDBObjectStore.prototype.get = function (...args) {
      if (this.name === "tracks") {
        IDBObjectStore.prototype.get = original;
        throw new Error("Privacy fixture read failed");
      }
      return original.apply(this, args);
    };
  });
  await privacy.click();
  await expect(page.getByRole("alert")).toContainText(
    "Privacy fixture read failed",
  );
  await expect(privacy).toBeChecked();
  await expect(privacy).toBeEnabled();
  await privacy.uncheck();
  await expect(privacy).not.toBeChecked();
  await privacy.focus();
  await page.keyboard.press("Space");
  await expect(privacy).toBeChecked();
  await expect(privacy).toBeEnabled();
  await page.keyboard.press("Space");
  await expect(privacy).not.toBeChecked();
  await expect(privacy).toBeEnabled();
  const actions = surface.getByRole("button", {
    name: "Track actions",
    exact: true,
  });
  await actions.click();
  await expect(actions).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByRole("menu")).toHaveCount(1);
  await page.keyboard.press("Escape");
  await expect(actions).toBeFocused();
  await expect(actions).toHaveAttribute("aria-expanded", "false");
  await surface
    .getByRole("button", { name: "Sound options", exact: true })
    .click();
  await chooseSound(page, "equalizer");
  await expect(page.locator(".player-scrim")).toBeHidden();
  await expect(page.getByRole("dialog")).toHaveCount(1);
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  await expect(
    surface.getByRole("button", { name: "Sound options", exact: true }),
  ).toBeFocused();
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
      if (width > 600)
        expect(
          Math.abs(h.y + h.height / 2 - b.y - b.height / 2),
        ).toBeLessThanOrEqual(1);
      else {
        expect(b.y - h.y - h.height).toBeGreaterThanOrEqual(11);
        expect(
          Math.abs(
            b.width -
              (await page.locator(".playlist-toolbar").boundingBox())!.width,
          ),
        ).toBeLessThanOrEqual(1);
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
      .locator(".playlists-page > .playlist-collection .playlist-tile")
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
