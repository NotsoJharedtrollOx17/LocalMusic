import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useCallback,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { reducedMotion } from "./motion";

export const librarySections = [
  "songs",
  "albums",
  "artists",
  "playlists",
  "year",
] as const;
export type LibrarySection = (typeof librarySections)[number];
export function useLibraryMotion(
  section: LibrarySection,
  onChange: (section: LibrarySection) => void,
) {
  const tabs = useRef<HTMLDivElement>(null),
    panel = useRef<HTMLElement>(null),
    scroll = useRef<Partial<Record<LibrarySection, number>>>({});
  const [tabsNode, setTabsNode] = useState<HTMLDivElement | null>(null),
    [panelNode, setPanelNode] = useState<HTMLElement | null>(null);
  const bindTabs = useCallback((node: HTMLDivElement | null) => {
    tabs.current = node;
    setTabsNode(node);
  }, []);
  const bindPanel = useCallback((node: HTMLElement | null) => {
    panel.current = node;
    setPanelNode(node);
  }, []);
  const [headingHeight, setHeadingHeight] = useState(105);
  useLayoutEffect(() => {
    const heading = panelNode?.querySelector<HTMLElement>(".page-heading");
    if (!heading) return;
    const update = () =>
      setHeadingHeight(heading.getBoundingClientRect().height);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(heading);
    return () => observer.disconnect();
  }, [panelNode]);
  const previous = useRef(section),
    gesture = useRef<{
      x: number;
      y: number;
      pointer: number;
      horizontal: boolean;
    } | null>(null);
  const suppressClickUntil = useRef(0);
  const resetSwipe = useCallback(() => {
    gesture.current = null;
    suppressClickUntil.current = 0;
  }, []);
  const [indicator, setIndicator] = useState({ width: 0, x: 0 }),
    [compact, setCompact] = useState(false);
  const choose = (next: LibrarySection) => {
    if (next === section) return;
    scroll.current[section] = window.scrollY;
    onChange(next);
  };
  useLayoutEffect(() => {
    const node = tabsNode;
    if (!node) return;
    const update = () => {
      const active = node.querySelector<HTMLElement>('[aria-selected="true"]');
      if (active) {
        setIndicator({ width: active.offsetWidth, x: active.offsetLeft });
        node.scrollTo({
          left: Math.max(
            0,
            active.offsetLeft - (node.clientWidth - active.offsetWidth) / 2,
          ),
          behavior: reducedMotion() ? "instant" : "smooth",
        });
      }
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(node);
    node
      .querySelectorAll("button")
      .forEach((button) => observer.observe(button));
    return () => observer.disconnect();
  }, [section, tabsNode]);
  useLayoutEffect(() => {
    if (previous.current !== section) {
      window.scrollTo({
        top: scroll.current[section] ?? 0,
        behavior: "instant",
      });
      const animation =
        !reducedMotion() && document.documentElement.dataset.layout !== "phone"
          ? panel.current
              ?.querySelector("#library-content")
              ?.animate([{ opacity: 0.6 }, { opacity: 1 }], {
                duration: 140,
                easing: "ease-out",
              })
          : undefined;
      previous.current = section;
      return () => animation?.cancel();
    }
  }, [section]);
  useEffect(() => {
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setCompact(window.scrollY > 96));
    };
    window.addEventListener("scroll", update, { passive: true });
    update();
    return () => {
      window.removeEventListener("scroll", update);
      cancelAnimationFrame(frame);
    };
  }, []);
  const swipe = {
    onPointerDown: (e: ReactPointerEvent) => {
      if (e.pointerType !== "touch") {
        resetSwipe();
        return;
      }
      if (gesture.current && gesture.current.pointer !== e.pointerId) {
        gesture.current = null;
        suppressClickUntil.current = performance.now() + 350;
        return;
      }
      suppressClickUntil.current = 0;
      if (
        (e.target as HTMLElement).closest(
          "input,select,textarea,[data-no-swipe],.section-tabs,.album-grid-carousel",
        )
      )
        return;
      gesture.current = {
        x: e.clientX,
        y: e.clientY,
        pointer: e.pointerId,
        horizontal: false,
      };
    },
    onPointerMove: (e: ReactPointerEvent) => {
      const g = gesture.current;
      if (!g || g.pointer !== e.pointerId) return;
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
      }
      suppressClickUntil.current = performance.now() + 350;
    },
    onPointerUp: (e: ReactPointerEvent) => {
      const g = gesture.current;
      gesture.current = null;
      if (!g || g.pointer !== e.pointerId || !g.horizontal) return;
      suppressClickUntil.current = performance.now() + 350;
      const dx = e.clientX - g.x,
        dy = e.clientY - g.y;
      if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) {
        suppressClickUntil.current = performance.now() + 350;
        const next =
          librarySections[librarySections.indexOf(section) + (dx < 0 ? 1 : -1)];
        if (next) choose(next);
      }
    },
    onPointerCancel: () => {
      gesture.current = null;
    },
    onClickCapture: (e: React.MouseEvent) => {
      if (e.detail > 0 && performance.now() < suppressClickUntil.current) {
        e.preventDefault();
        e.stopPropagation();
      }
    },
  };
  return {
    tabs,
    panel,
    bindTabs,
    bindPanel,
    headingHeight,
    indicator,
    compact,
    choose,
    swipe,
    resetSwipe,
  };
}
