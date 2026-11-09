import { useLayoutEffect, useSyncExternalStore } from "react";

const query = "(max-width: 760px)";
function snapshot() {
  return (
    document.documentElement.dataset.platform === "android" ||
    matchMedia(query).matches
  );
}
function subscribe(change: () => void) {
  const media = matchMedia(query);
  media.addEventListener("change", change);
  return () => media.removeEventListener("change", change);
}
export function usePhoneLayout() {
  const phone = useSyncExternalStore(subscribe, snapshot);
  useLayoutEffect(() => {
    document.documentElement.dataset.layout = phone ? "phone" : "desktop";
  }, [phone]);
  return phone;
}

/** Touch feedback and hardware-keyboard focus have different lifetimes. */
export function installInputModality() {
  const root = document.documentElement;
  let press: { node: HTMLElement; id: number; x: number; y: number } | null =
    null;
  const clearPress = () => {
    press?.node.removeAttribute("data-touch-pressed");
    press = null;
  };
  root.dataset.input = "pointer";
  document.addEventListener(
    "pointerdown",
    (event) => {
      root.dataset.input = "pointer";
      const wasPressed = !!press;
      clearPress();
      if (wasPressed || event.button !== 0) return;
      const node =
        event.target instanceof Element
          ? event.target.closest<HTMLElement>(".icon-button:not(:disabled)")
          : null;
      if (node && root.dataset.layout === "phone") {
        press = {
          node,
          id: event.pointerId,
          x: event.clientX,
          y: event.clientY,
        };
        node.setAttribute("data-touch-pressed", "true");
      }
    },
    true,
  );
  document.addEventListener(
    "pointermove",
    (event) => {
      if (
        press &&
        (press.id !== event.pointerId ||
          Math.hypot(event.clientX - press.x, event.clientY - press.y) > 10)
      )
        clearPress();
    },
    true,
  );
  for (const event of [
    "pointerup",
    "pointercancel",
    "lostpointercapture",
  ] as const)
    document.addEventListener(event, clearPress, true);
  window.addEventListener("blur", clearPress);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) clearPress();
  });
  document.addEventListener(
    "keydown",
    (event) => {
      if (!["Alt", "Control", "Meta"].includes(event.key))
        root.dataset.input = "keyboard";
      clearPress();
    },
    true,
  );
}
