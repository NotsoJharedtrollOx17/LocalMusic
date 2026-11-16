let cleanup: (() => void) | undefined;

/** A touch-up that replaces its target must not click the new view beneath it. */
export function consumeCompatibilityClick() {
  cleanup?.();
  let timer: ReturnType<typeof setTimeout>;
  const clear = () => {
    clearTimeout(timer);
    document.removeEventListener("click", click, true);
    document.removeEventListener("pointerdown", clear, true);
    window.removeEventListener("blur", clear);
    if (cleanup === clear) cleanup = undefined;
  };
  const click = (event: MouseEvent) => {
    if (event.detail === 0) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    clear();
  };
  document.addEventListener("click", click, true);
  // A new physical press always works immediately.
  document.addEventListener("pointerdown", clear, true);
  window.addEventListener("blur", clear);
  timer = setTimeout(clear, 500);
  cleanup = clear;
}
