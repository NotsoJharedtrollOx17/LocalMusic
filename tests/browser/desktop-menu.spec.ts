import { test, expect } from "@playwright/test";
import { DetachedFixture } from "./detached-window-fixture";
import type { MenuCommand } from "../../src/desktop/menu";

test("native menu dispatch, check state, scoped search, manual creator and local help", async ({
  page,
  context,
}) => {
  const f = new DetachedFixture(context);
  f.nativeMenu = true;
  await f.attach(page);
  await page.goto("/");
  const state = () => f.menuStates.at(-1);
  const command = async (command: MenuCommand) => {
    await expect.poll(() => state()?.enabled.includes(command)).toBe(true);
    await f.emit("desktop://menu", { command, revision: state().revision });
  };
  await expect.poll(() => state()?.section).toBe("songs");
  await command("albums");
  await expect(
    page.getByRole("tab", { name: "Albums", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await expect(
    page.getByRole("button", { name: "Library actions" }),
  ).toHaveCount(0);
  await command("search");
  await expect(page.getByRole("searchbox")).toBeFocused();
  await command("new-playlist");
  await expect(
    page.getByRole("dialog", { name: "New playlist", exact: true }),
  ).toBeVisible();
  // Even a stale/malicious delivery cannot replace an open dialog.
  await f.emit("desktop://menu", { command: "about", revision: 1 });
  await expect(page.getByRole("dialog")).toHaveCount(1);
  await page.keyboard.press("Escape");
  await command("toggle");
  await expect.poll(() => state()?.playing).toBe(true);
  f.playbackFailure = true;
  await command("shuffle");
  await expect(page.getByRole("alert")).toContainText(
    "Simulated playback command failure",
  );
  expect(state()?.shuffle).toBe(false);
  f.playbackFailure = false;
  await command("shuffle");
  await expect.poll(() => state()?.shuffle).toBe(true);
  await command("repeat-one");
  await expect.poll(() => state()?.repeat).toBe("one");
  await command("help");
  await expect(
    page.getByRole("dialog", {
      name: "Help and keyboard shortcuts",
      exact: true,
    }),
  ).toContainText("Ctrl+O");
  await page.keyboard.press("Escape");
  await command("about");
  await expect(
    page.getByRole("dialog", { name: "About Local Music", exact: true }),
  ).toContainText("0.13.0");
  await page.keyboard.press("Escape");
  await command("settings");
  await page.getByRole("button", { name: "Español", exact: true }).click();
  await expect.poll(() => state()?.language).toBe("es");
  await page.keyboard.press("Escape");
  await command("help");
  await expect(
    page.getByRole("dialog", {
      name: "Ayuda y atajos de teclado",
      exact: true,
    }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await command("year");
  await expect.poll(() => state()?.enabled.includes("search")).toBe(false);
  expect(
    f.calls.filter((c) => c === "main:plugin:event|listen").length,
  ).toBeGreaterThan(0);
});

test("failed native initialization keeps legacy actions and Retry installs the menu", async ({
  page,
  context,
}) => {
  const f = new DetachedFixture(context);
  f.nativeMenu = true;
  f.menuFailure = true;
  await f.attach(page);
  await page.goto("/");
  await expect(page.getByRole("alert")).toContainText(
    "Simulated native menu failure",
  );
  await page
    .getByRole("button", { name: "Library actions", exact: true })
    .click();
  await expect(
    page.getByRole("menuitem", { name: "Settings", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("menuitem", { name: "Equalizer", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  f.menuFailure = false;
  await page
    .getByRole("alert")
    .getByRole("button", { name: "Try again", exact: true })
    .click();
  await expect(page.getByRole("alert")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Library actions", exact: true })
    .click();
  await expect(
    page.getByRole("menuitem", { name: "Settings", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("menuitem", { name: "Equalizer", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("menuitem", { name: "Edit", exact: true }),
  ).toBeVisible();
  const subscriptions = f.listeners
    .get(page)!
    .filter((l) => l.event === "desktop://menu");
  expect(subscriptions).toHaveLength(1);
});

test("Window commands switch an existing detached Queue without duplicating or mounting a menu in children", async ({
  page,
  context,
}) => {
  const f = new DetachedFixture(context);
  f.nativeMenu = true;
  await f.attach(page);
  await page.goto("/");
  const command = async (command: MenuCommand) => {
    await expect
      .poll(() => f.menuStates.at(-1)?.enabled.includes(command))
      .toBe(true);
    await f.emit("desktop://menu", {
      command,
      revision: f.menuStates.at(-1).revision,
    });
  };
  await command("detach-player");
  await expect.poll(() => f.windows[0]?.phase).toBe("detached");
  const child = f.children.get("player")!;
  await command("queue");
  await expect(
    child.getByRole("dialog", { name: "Queue", exact: true }),
  ).toBeVisible();
  await command("player");
  await expect(
    child.getByRole("dialog", { name: "Now playing", exact: true }),
  ).toBeVisible();
  expect(f.children.size).toBe(1);
  expect(f.calls.some((c) => c === "player:desktop_menu_sync")).toBe(false);
  await command("equalizer");
  await expect
    .poll(() => f.windows.find((w) => w.view === "equalizer")?.phase)
    .toBe("detached");
  expect(f.calls.some((c) => c === "equalizer:desktop_menu_sync")).toBe(false);
});
