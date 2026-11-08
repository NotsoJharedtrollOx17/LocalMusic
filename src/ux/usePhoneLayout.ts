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
  root.dataset.input = "pointer";
  document.addEventListener(
    "pointerdown",
    () => {
      root.dataset.input = "pointer";
    },
    true,
  );
  document.addEventListener(
    "keydown",
    (event) => {
      if (!["Alt", "Control", "Meta"].includes(event.key))
        root.dataset.input = "keyboard";
    },
    true,
  );
}
