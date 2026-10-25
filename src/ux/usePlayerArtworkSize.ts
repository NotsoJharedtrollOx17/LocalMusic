import { useLayoutEffect, type RefObject } from "react";

/** Fit square artwork into the space remaining above the anchored controls. */
export function usePlayerArtworkSize(
  surface: RefObject<HTMLDivElement | null>,
  active: boolean,
  view: string,
  trackId: string,
) {
  useLayoutEffect(() => {
    if (!active || view !== "player") return;
    const body = surface.current?.querySelector<HTMLElement>(
      ".player-surface-body",
    );
    const content = body?.querySelector<HTMLElement>(".full-player");
    const artwork = content?.querySelector<HTMLElement>(".player-cover");
    if (!body || !content || !artwork) return;
    const fit = () => {
      const padding = getComputedStyle(body);
      const otherContent = content.offsetHeight - artwork.offsetHeight;
      const available =
        body.clientHeight -
        parseFloat(padding.paddingTop) -
        parseFloat(padding.paddingBottom) -
        otherContent;
      const size = Math.floor(
        Math.max(
          32,
          Math.min(
            320,
            content.clientWidth,
            matchMedia("(max-height: 400px)").matches
              ? Math.min(160, innerHeight * 0.4)
              : available - 2,
          ),
        ),
      );
      const value = `${size}px`;
      if (body.style.getPropertyValue("--player-art-size") !== value)
        body.style.setProperty("--player-art-size", value);
    };
    const observer = new ResizeObserver(fit);
    observer.observe(body);
    observer.observe(content);
    window.addEventListener("resize", fit);
    fit();
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", fit);
    };
  }, [surface, active, view, trackId]);
}
