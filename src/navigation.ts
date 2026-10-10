import { useEffect, useRef } from "react";
const backLayers: Array<() => void> = [];
declare global {
  interface Window {
    __musicBack?: () => boolean;
  }
}
window.__musicBack = () => {
  const close = backLayers.at(-1);
  if (!close) return false;
  close();
  return true;
};
export function useBackLayer(enabled: boolean, onBack: () => void) {
  const latest = useRef(onBack);
  latest.current = onBack;
  useEffect(() => {
    if (!enabled) return;
    const back = () => latest.current();
    backLayers.push(back);
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape" && backLayers.at(-1) === back) {
        e.preventDefault();
        e.stopImmediatePropagation();
        back();
      }
    };
    document.addEventListener("keydown", key, true);
    return () => {
      const index = backLayers.indexOf(back);
      if (index >= 0) backLayers.splice(index, 1);
      document.removeEventListener("keydown", key, true);
    };
  }, [enabled]);
}
