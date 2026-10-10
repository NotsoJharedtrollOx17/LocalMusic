/** Native shell shortcuts are app-owned; browser preview keeps developer tools. */
export function isBrowserShortcut(
  event: Pick<
    KeyboardEvent,
    "key" | "ctrlKey" | "metaKey" | "altKey" | "shiftKey"
  >,
) {
  const key = event.key.toLowerCase();
  const modifier = event.ctrlKey || event.metaKey;
  return (
    key === "f5" ||
    key === "f12" ||
    (modifier && key === "r") ||
    (modifier &&
      (event.shiftKey || (event.metaKey && event.altKey)) &&
      ["i", "j", "c"].includes(key))
  );
}

export function installNativeShortcuts(native: boolean) {
  if (!native) return;
  document.addEventListener(
    "keydown",
    (event) => {
      if (!isBrowserShortcut(event)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
    },
    true,
  );
}
