import { useContext, useLayoutEffect, useRef, type RefObject } from "react";
import { AndroidPlayerDrag } from "./androidPlayerDrag";
import { reducedMotion } from "./motion";

function playerFrame(surface: HTMLElement, closing: boolean) {
  const mini = document.querySelector<HTMLElement>(".mini-player");
  const full = surface.getBoundingClientRect();
  const dock = mini?.getBoundingClientRect();
  const panel = surface.querySelector<HTMLElement>(".android-player-backdrop");
  if (!panel || !dock?.width || !full.width || !full.height) return null;
  const miniCover = mini?.querySelector<HTMLImageElement>(".mini-track .cover");
  const fullCover = surface.querySelector<HTMLImageElement>(".player-cover");
  const from = miniCover?.getBoundingClientRect();
  const to = fullCover?.getBoundingClientRect();
  const sources = closing ? [fullCover, miniCover] : [miniCover, fullCover];
  const source = sources.find((image) => image?.complete && image.naturalWidth)?.currentSrc;
  const cover = source && from?.width && to?.width ? new Image() : null;
  if (cover && to && source) {
    cover.src = source;
    cover.alt = "";
    cover.className = "cover-flight android-player-cover-flight";
    Object.assign(cover.style, {
      left: `${to.left}px`, top: `${to.top}px`,
      width: `${to.width}px`, height: `${to.height}px`,
    });
    surface.append(cover);
    surface.dataset.coverFlight = "true";
  }
  const travel = Math.max(1, dock.top - full.top);
  const radius = parseFloat(getComputedStyle(mini!).borderTopLeftRadius) || 0;
  surface.dataset.playerTransition = "true";
  return {
    travel,
    paint(progress: number) {
      const remaining = 1 - progress;
      const scaleX = 1 - (1 - dock.width / full.width) * remaining;
      const scaleY = 1 - (1 - dock.height / full.height) * remaining;
      panel.style.transform = `translate(${(dock.left - full.left) * remaining}px,${travel * remaining}px) scale(${scaleX},${scaleY})`;
      panel.style.borderRadius = `${radius * remaining / scaleX}px / ${radius * remaining / scaleY}px`;
      surface.style.setProperty("--player-progress", String(progress));
      if (cover && from && to) {
        const width = 1 - (1 - from.width / to.width) * remaining;
        const height = 1 - (1 - from.height / to.height) * remaining;
        cover.style.transform = `translate(${(from.left - to.left) * remaining}px,${(from.top - to.top) * remaining}px) scale(${width},${height})`;
      }
    },
    dispose() {
      cover?.remove();
      panel.style.removeProperty("transform");
      panel.style.removeProperty("border-radius");
      surface.style.removeProperty("--player-progress");
      delete surface.dataset.playerTransition;
      delete surface.dataset.coverFlight;
    },
  };
}

export function useAndroidPlayerMotion(
  ref: RefObject<HTMLDivElement | null>,
  enabled: boolean,
  active: boolean,
  preview: boolean,
  trackId: string,
  onClose: () => void,
) {
  const drag = useContext(AndroidPlayerDrag);
  const entered = useRef(false);
  const frame = useRef<ReturnType<typeof playerFrame>>(null);
  const progress = useRef(1);
  const target = useRef<0 | 1>(1);
  const raf = useRef(0);
  const owner = useRef({ active, preview, onClose });
  owner.current = { active, preview, onClose };

  const dispose = () => {
    cancelAnimationFrame(raf.current);
    frame.current?.dispose();
    frame.current = null;
  };
  const paint = (value: number) => {
    progress.current = Math.max(0, Math.min(1, value));
    frame.current?.paint(progress.current);
  };
  const prepare = () => {
    if (!frame.current && ref.current && !reducedMotion())
      frame.current = playerFrame(ref.current, target.current === 0);
    return frame.current;
  };
  const settle = (end: 0 | 1, done?: () => void) => {
    target.current = end;
    cancelAnimationFrame(raf.current);
    const from = progress.current;
    if (reducedMotion() || !prepare() || from === end) {
      progress.current = end;
      if (end === 1 || !done) dispose();
      done?.();
      return;
    }
    paint(from);
    const start = performance.now();
    const duration = Math.max(80, 240 * Math.abs(end - from));
    const tick = (now: number) => {
      const t = Math.max(0, Math.min(1, (now - start) / duration));
      paint(from + (end - from) * (1 - Math.pow(1 - t, 3)));
      if (t < 1) raf.current = requestAnimationFrame(tick);
      else {
        // React can commit the close after this animation frame. Keep the
        // collapsed geometry until unmount so the full player cannot repaint.
        if (end === 1 || !done) dispose();
        done?.();
      }
    };
    raf.current = requestAnimationFrame(tick);
  };
  const cancelPreview = () => settle(0, drag?.clear);
  const close = () => settle(0, () => owner.current.onClose());
  const release = (commit: boolean) => {
    if (commit) close();
    else if (frame.current) settle(1);
  };

  useLayoutEffect(() => {
    if (enabled && preview && drag) {
      drag.receiver.current = (distance) => {
        if (distance === null) cancelPreview();
        else {
          const current = prepare();
          if (current) {
            cancelAnimationFrame(raf.current);
            paint(distance / current.travel);
          }
        }
      };
      drag.receiver.current(drag.distance.current);
      return () => { drag.receiver.current = null; };
    }
  }, [enabled, preview]);

  useLayoutEffect(() => {
    if (!active) return;
    const first = !entered.current;
    entered.current = true;
    if (enabled && first) {
      if (!frame.current) {
        prepare();
        paint(0);
      }
      settle(1);
    }
  }, [active, enabled]);

  useLayoutEffect(() => {
    if (!enabled || (!active && !preview)) {
      dispose();
      progress.current = 1;
    }
  }, [enabled, active, preview]);

  const lastTrack = useRef(trackId);
  useLayoutEffect(() => {
    if (!enabled) return;
    const reset = () => {
      const closing = frame.current && owner.current.active && target.current === 0;
      dispose();
      progress.current = 1;
      target.current = 1;
      if (owner.current.preview) drag?.clear();
      else if (closing) owner.current.onClose();
    };
    if (lastTrack.current !== trackId) reset();
    lastTrack.current = trackId;
    window.addEventListener("resize", reset);
    return () => window.removeEventListener("resize", reset);
  }, [enabled, trackId]);
  useLayoutEffect(() => dispose, []);

  return {
    close,
    release,
    cancelPreview,
    move(distance: number) {
      const current = prepare();
      if (current) {
        target.current = 1;
        cancelAnimationFrame(raf.current);
        paint(1 - distance / current.travel);
      }
    },
  };
}
