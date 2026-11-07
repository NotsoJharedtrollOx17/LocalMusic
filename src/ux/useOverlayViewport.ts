import { useLayoutEffect, type RefObject } from "react";

/** Fit overlays to the visible WebView, including an open software keyboard. */
export function useOverlayViewport(ref: RefObject<HTMLElement | null>) {
  useLayoutEffect(() => {
    const node = ref.current,
      viewport = window.visualViewport;
    if (!node || !viewport) return;
    const update = () => {
      node.style.setProperty("--overlay-top", `${viewport.offsetTop}px`);
      node.style.setProperty("--overlay-left", `${viewport.offsetLeft}px`);
      node.style.setProperty("--overlay-width", `${viewport.width}px`);
      node.style.setProperty("--overlay-height", `${viewport.height}px`);
      node.toggleAttribute("data-short-viewport", viewport.height <= 520);
    };
    update();
    viewport.addEventListener("resize", update);
    viewport.addEventListener("scroll", update);
    return () => {
      viewport.removeEventListener("resize", update);
      viewport.removeEventListener("scroll", update);
    };
  }, [ref]);
}
