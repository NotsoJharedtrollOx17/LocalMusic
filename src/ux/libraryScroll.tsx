import { createContext, useContext } from "react";

export const LibraryScrollContext = createContext<HTMLElement | null>(null);
export const LibraryScrollOffsetContext = createContext(0);
export const useLibraryInitialOffset = () =>
  useContext(LibraryScrollOffsetContext);
export const useLibraryScroll = () => useContext(LibraryScrollContext);
export function libraryScroller() {
  return document.querySelector<HTMLElement>(
    '.library-pane[data-active="true"]',
  );
}
export function libraryScrollTop() {
  return libraryScroller()?.scrollTop ?? window.scrollY;
}
let restoration = 0;
document.addEventListener("pointerdown", () => ++restoration, true);
document.addEventListener("wheel", () => ++restoration, {
  passive: true,
  capture: true,
});
export function scrollLibraryTo(options: ScrollToOptions) {
  const request = ++restoration;
  const pane = libraryScroller();
  if (!pane) {
    window.scrollTo(options);
    return;
  }
  let attempts = 0;
  const apply = () => {
    if (request !== restoration || libraryScroller() !== pane) return;
    pane.scrollTo(options);
    // A returning virtual list establishes its full range during layout. Do
    // not lose the saved anchor by clamping against the outgoing detail page.
    if (
      typeof options.top === "number" &&
      Math.abs(pane.scrollTop - options.top) > 1 &&
      ++attempts < 16
    )
      requestAnimationFrame(apply);
  };
  apply();
}

export function captureLibraryPosition() {
  document.dispatchEvent(new Event("library-save-scroll"));
}
