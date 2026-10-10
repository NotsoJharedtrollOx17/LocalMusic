import { describe, expect, it } from "vitest";
import { installNativeShortcuts, isBrowserShortcut } from "./nativeShortcuts";

const event = (key: string, modifiers = {}) => ({
  key,
  ctrlKey: false,
  metaKey: false,
  shiftKey: false,
  altKey: false,
  ...modifiers,
});
describe("native browser shortcuts", () => {
  it("blocks reload and inspector variants", () => {
    for (const shortcut of [
      event("F5"),
      event("F12"),
      event("r", { ctrlKey: true }),
      event("R", { ctrlKey: true, shiftKey: true }),
      event("r", { metaKey: true }),
      ...["i", "j", "c"].flatMap((key) => [
        event(key, { ctrlKey: true, shiftKey: true }),
        event(key, { metaKey: true, altKey: true }),
      ]),
    ])
      expect(isBrowserShortcut(shortcut)).toBe(true);
  });
  it("preserves editing, zoom, menu and navigation keys", () => {
    for (const shortcut of [
      event("r"),
      event("F2"),
      event("F10", { shiftKey: true }),
      event("ContextMenu"),
      event("Escape"),
      event("Tab"),
      event("ArrowDown"),
      ...["c", "v", "x", "a", "+", "-", "0"].map((key) =>
        event(key, { ctrlKey: true }),
      ),
    ])
      expect(isBrowserShortcut(shortcut)).toBe(false);
    expect(() => installNativeShortcuts(false)).not.toThrow();
  });
});
