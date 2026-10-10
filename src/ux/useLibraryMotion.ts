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
    gesture = useRef<{ x: number; y: number } | null>(null);
  const suppressClickUntil = useRef(0);
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
        active.scrollIntoView({
          block: "nearest",
          inline: "center",
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
      const direction =
        librarySections.indexOf(section) >
        librarySections.indexOf(previous.current)
          ? 1
          : -1;
      window.scrollTo({
        top: scroll.current[section] ?? 0,
        behavior: "instant",
      });
      const animation = !reducedMotion()
        ? panel.current?.querySelector("#library-content")?.animate(
            [
              { opacity: 0.5, transform: `translateX(${direction * 12}px)` },
              { opacity: 1, transform: "none" },
            ],
            { duration: 240, easing: "cubic-bezier(.2,.8,.2,1)" },
          )
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
      suppressClickUntil.current = 0;
      if (
        e.pointerType !== "touch" ||
        (e.target as HTMLElement).closest(
          "input,select,textarea,[data-no-swipe],.section-tabs,.album-grid-carousel",
        )
      )
        return;
      gesture.current = { x: e.clientX, y: e.clientY };
    },
    onPointerMove: (e: ReactPointerEvent) => {
      const g = gesture.current;
      if (!g) return;
      const dx = e.clientX - g.x,
        dy = e.clientY - g.y;
      if (Math.abs(dy) > Math.abs(dx)) {
        gesture.current = null;
        if (panel.current) panel.current.style.transform = "";
        return;
      }
      if (panel.current && !reducedMotion())
        panel.current.style.transform = `translateX(${Math.max(-35, Math.min(35, dx * 0.2))}px)`;
    },
    onPointerUp: (e: ReactPointerEvent) => {
      const g = gesture.current;
      gesture.current = null;
      if (panel.current) panel.current.style.transform = "";
      if (!g) return;
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
      if (panel.current) panel.current.style.transform = "";
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
  };
}
