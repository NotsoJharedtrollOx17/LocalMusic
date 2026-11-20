import {
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent,
  type MouseEvent,
} from "react";
import { librarySections, type LibrarySection } from "./useLibraryMotion";
import { reducedMotion } from "./motion";
import { useGestureCancellation } from "./useGestureCancellation";

export type ContentPager = ReturnType<typeof useContentPager>["controller"];
export function useContentPager(
  section: LibrarySection,
  commit: (next: LibrarySection) => void,
  enabled: boolean,
) {
  const track = useRef<HTMLDivElement>(null);
  const latest = useRef({ section, commit, enabled });
  latest.current = { section, commit, enabled };
  const [destination, setDestination] = useState<LibrarySection | null>(null);
  const animation = useRef<Animation | null>(null);
  const offset = useRef(0),
    suppress = useRef(0);
  const gesture = useRef<{
    x: number;
    y: number;
    time: number;
    startOffset: number;
    id: number;
    horizontal: boolean;
  } | null>(null);
  const indicatorDrag = useRef<{
    strip: HTMLElement;
    active: HTMLElement;
    neighbors: Array<HTMLElement | null>;
  } | null>(null);
  const releaseIndicator = () => {
    const strip = indicatorDrag.current?.strip;
    strip?.style.removeProperty("--drag-tab-x");
    strip?.style.removeProperty("--drag-tab-width");
    strip?.removeAttribute("data-dragging");
    indicatorDrag.current = null;
  };
  const reset = () => {
    releaseIndicator();
    animation.current?.cancel();
    animation.current = null;
    gesture.current = null;
    offset.current = 0;
    if (track.current) track.current.style.transform = "";
  };
  const entry = useRef<number | null>(null);
  const animate = (from: number) => {
    const node = track.current;
    if (!node || reducedMotion() || !from) {
      reset();
      return;
    }
    const motion = node.animate(
      [{ transform: `translateX(${from}px)` }, { transform: "translateX(0)" }],
      { duration: 180, easing: "cubic-bezier(.2,.8,.2,1)" },
    );
    animation.current = motion;
    motion.onfinish = () => {
      if (animation.current === motion) {
        animation.current = null;
        setDestination(null);
      }
    };
  };
  const settle = (next: LibrarySection | null, from = offset.current) => {
    const active = latest.current.section;
    const width = track.current?.clientWidth ?? innerWidth;
    if (next) {
      const direction = Math.sign(
        librarySections.indexOf(next) - librarySections.indexOf(active),
      );
      entry.current = reducedMotion() ? 0 : from + direction * width;
      setDestination(active);
      latest.current.commit(next);
    } else {
      reset();
      animate(from);
    }
  };
  useLayoutEffect(() => {
    const from = entry.current;
    entry.current = null;
    reset();
    if (from !== null) animate(from);
  }, [section]);
  useGestureCancellation(() => {
    if (gesture.current) {
      suppress.current = performance.now() + 350;
      reset();
    }
  }, enabled);
  useLayoutEffect(() => {
    if (!enabled) reset();
    return reset;
  }, [enabled]);
  const controller = {
    reset,
    choose(next: LibrarySection) {
      if (next === latest.current.section) return;
      reset();
      if (
        !latest.current.enabled ||
        reducedMotion() ||
        Math.abs(
          librarySections.indexOf(next) -
            librarySections.indexOf(latest.current.section),
        ) > 1
      ) {
        setDestination(null);
        latest.current.commit(next);
      } else settle(next, 0);
    },
    swipe: {
      onPointerDown(e: PointerEvent) {
        if (gesture.current && gesture.current.id !== e.pointerId) {
          reset();
          suppress.current = performance.now() + 350;
          return;
        }
        if (!e.isPrimary) {
          suppress.current = performance.now() + 350;
          return;
        }
        suppress.current = 0;
        if (
          e.pointerType !== "touch" ||
          !latest.current.enabled ||
          (e.target as HTMLElement).closest(
            "input,select,textarea,[data-no-swipe],.section-tabs,.album-grid-carousel",
          )
        )
          return;
        const node = track.current;
        const startOffset = node && animation.current
          ? new DOMMatrixReadOnly(getComputedStyle(node).transform).m41
          : 0;
        reset();
        if (node && startOffset) {
          node.style.transform = `translateX(${startOffset}px)`;
          offset.current = startOffset;
          suppress.current = performance.now() + 350;
        }
        gesture.current = {
          startOffset,
          x: e.clientX,
          y: e.clientY,
          time: performance.now(),
          id: e.pointerId,
          horizontal: false,
        };
      },
      onPointerMove(e: PointerEvent) {
        const g = gesture.current;
        if (!g || g.id !== e.pointerId) return;
        const dx = e.clientX - g.x,
          dy = e.clientY - g.y;
        if (!g.horizontal) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) < 12) return;
          suppress.current = performance.now() + 350;
          if (Math.abs(dy) > Math.abs(dx) * 1.15) {
            settle(null);
            return;
          }
          if (Math.abs(dx) <= Math.abs(dy) * 1.15) return;
          g.horizontal = true;
          const strip = document.querySelector<HTMLElement>(".section-tabs");
          const active = strip?.querySelector<HTMLElement>('[aria-selected="true"]');
          if (strip && active && !reducedMotion()) {
            indicatorDrag.current = { strip, active, neighbors: [
              active.previousElementSibling?.matches("button") ? active.previousElementSibling as HTMLElement : null,
              active.nextElementSibling as HTMLElement | null,
            ] };
          }
          // Cancel hold selection and any pressed target before the panes move.
          document.dispatchEvent(new Event("library-paging"));
        }
        suppress.current = performance.now() + 350;
        const next =
          librarySections[
            librarySections.indexOf(latest.current.section) + (dx < 0 ? 1 : -1)
          ];
        const width = track.current?.clientWidth ?? innerWidth;
        const drag = Math.sign(dx) * Math.max(0, Math.abs(dx) - 12);
        offset.current = Math.max(-width, Math.min(width,
          g.startOffset + (next ? drag : dx * 0.18),
        ));
        const indicator = indicatorDrag.current;
        if (indicator) {
          const { strip, active, neighbors } = indicator;
          const neighbor = neighbors[dx < 0 ? 1 : 0] ?? active;
          const progress = Math.min(1, Math.abs(drag) / width);
          const x = active.offsetLeft + (neighbor.offsetLeft - active.offsetLeft) * progress;
          const w = active.offsetWidth + (neighbor.offsetWidth - active.offsetWidth) * progress;
          strip.dataset.dragging = "true";
          strip.style.setProperty("--drag-tab-x", x + "px");
          strip.style.setProperty("--drag-tab-width", w + "px");
        }
        if (track.current && !reducedMotion())
          track.current.style.transform = `translateX(${offset.current}px)`;
      },
      onPointerUp(e: PointerEvent) {
        const g = gesture.current;
        gesture.current = null;
        if (!g || g.id !== e.pointerId) return;
        if (!g.horizontal) {
          if (g.startOffset) {
            suppress.current = performance.now() + 350;
            settle(null);
          }
          return;
        }
        suppress.current = performance.now() + 350;
        const dx = e.clientX - g.x,
          travel = Math.abs(dx),
          width = track.current?.clientWidth ?? innerWidth;
        const next =
          librarySections[
            librarySections.indexOf(latest.current.section) + (dx < 0 ? 1 : -1)
          ];
        const accepted =
          travel >= width * 0.2 ||
          (travel >= 36 &&
            travel / Math.max(1, performance.now() - g.time) > 0.35);
        settle(accepted && next ? next : null);
      },
      onClickCapture(e: MouseEvent) {
        if (e.detail > 0 && performance.now() < suppress.current) {
          e.preventDefault();
          e.stopPropagation();
        }
      },
    },
  };
  return { track, destination, controller };
}
