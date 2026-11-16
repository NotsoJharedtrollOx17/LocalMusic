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
    id: number;
    horizontal: boolean;
  } | null>(null);
  const reset = () => {
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
    if (gesture.current) suppress.current = performance.now() + 350;
    reset();
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
        suppress.current = 0;
        if (
          e.pointerType !== "touch" ||
          !e.isPrimary ||
          !latest.current.enabled ||
          (e.target as HTMLElement).closest(
            "input,select,textarea,[data-no-swipe],.section-tabs,.album-grid-carousel",
          )
        )
          return;
        reset();
        gesture.current = {
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
          if (Math.abs(dy) > Math.abs(dx) * 1.15) {
            gesture.current = null;
            return;
          }
          if (Math.abs(dx) <= Math.abs(dy) * 1.15) return;
          g.horizontal = true;
          // Cancel hold selection and any pressed target before the panes move.
          document.dispatchEvent(new Event("library-paging"));
        }
        suppress.current = performance.now() + 350;
        const next =
          librarySections[
            librarySections.indexOf(latest.current.section) + (dx < 0 ? 1 : -1)
          ];
        const width = track.current?.clientWidth ?? innerWidth;
        offset.current = next
          ? Math.max(-width, Math.min(width, dx))
          : dx * 0.18;
        if (track.current && !reducedMotion())
          track.current.style.transform = `translateX(${offset.current}px)`;
      },
      onPointerUp(e: PointerEvent) {
        const g = gesture.current;
        gesture.current = null;
        if (!g?.horizontal || g.id !== e.pointerId) return;
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
          (travel >= 24 &&
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
