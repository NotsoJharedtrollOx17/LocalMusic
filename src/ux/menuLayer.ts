type MenuLayer = { close: () => void };
let active: MenuLayer | undefined;

/** Coordinate owners without moving object-specific state into App. */
export function claimMenu(layer: MenuLayer) {
  active?.close();
  active = layer;
  return () => {
    if (active === layer) active = undefined;
  };
}
export function dismissMenu() {
  active?.close();
}
export function hasOpenMenu() {
  return !!active;
}

/** Outside dismissal must not also play the row beneath the menu. */
export function consumeDismissalClick() {
  const clean = () => {
    document.removeEventListener("click", click, true);
    document.removeEventListener("pointerup", up, true);
    document.removeEventListener("pointercancel", clean, true);
    window.removeEventListener("blur", clean);
  };
  const click = (event: MouseEvent) => {
    event.preventDefault();
    event.stopImmediatePropagation();
    clean();
  };
  const up = () => window.setTimeout(clean, 0);
  document.addEventListener("click", click, true);
  document.addEventListener("pointerup", up, true);
  document.addEventListener("pointercancel", clean, true);
  window.addEventListener("blur", clean);
}
