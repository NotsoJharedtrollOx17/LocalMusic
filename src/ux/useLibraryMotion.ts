import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useCallback,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { reducedMotion } from "./motion";
import { useGestureCancellation } from "./useGestureCancellation";

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
  const previous = useRef(section);
  const tabFrame = useRef(0);
  const cancelTabMotion = useCallback(() => {
    cancelAnimationFrame(tabFrame.current);
    tabFrame.current = 0;
  }, []);
  const contentPager = useRef<import("./useContentPager").ContentPager | null>(
    null,
  );
  const resetSwipe = useCallback(() => contentPager.current?.reset(), []);
  const [indicator, setIndicator] = useState({ width: 0, x: 0 }),
    [compact, setCompact] = useState(false);
  const commit = (next: LibrarySection) => {
    if (next === section) return;
    if (document.documentElement.dataset.layout !== "phone")
      scroll.current[section] = window.scrollY;
    onChange(next);
  };
  const choose = (next: LibrarySection) => {
    if (contentPager.current) contentPager.current.choose(next);
    else commit(next);
  };
  const revealTab = useCallback(
    (active: HTMLElement) => {
      const node = tabs.current;
      if (!node) return;
      const left = active.offsetLeft,
        right = left + active.offsetWidth;
      const start = node.scrollLeft,
        end = start + node.clientWidth;
      const target =
        document.documentElement.dataset.layout === "phone"
          ? (active.id === "tab-year" && document.documentElement.dataset.platform === "android"
              ? Math.max(0, right - node.clientWidth)
              : left)
          : left < start
            ? left
            : right > end
              ? right - node.clientWidth
              : start;
      cancelTabMotion();
      if (Math.abs(target - start) <= 1) return;
      if (
        document.documentElement.dataset.layout !== "phone" ||
        reducedMotion()
      ) {
        node.scrollTo({
          left: target,
          behavior: reducedMotion() ? "instant" : "smooth",
        });
        return;
      }
      const started = performance.now();
      const frame = (time: number) => {
        const t = Math.min(1, (time - started) / 180);
        node.scrollTo({
          left: start + (target - start) * (1 - Math.pow(1 - t, 3)),
          behavior: "instant",
        });
        tabFrame.current = t < 1 ? requestAnimationFrame(frame) : 0;
      };
      tabFrame.current = requestAnimationFrame(frame);
    },
    [cancelTabMotion],
  );
  useLayoutEffect(() => {
    const node = tabsNode;
    if (!node) return;
    let geometry = "";
    const update = () => {
      const buttons = node.querySelectorAll<HTMLButtonElement>('[role="tab"]');
      const last = buttons[buttons.length - 1];
      if (last)
        node.style.setProperty(
          "--tab-tail-width",
          `${Math.max(
            0,
            node.clientWidth -
              last.offsetWidth -
              parseFloat(getComputedStyle(node).columnGap || "0"),
          )}px`,
        );
      const active = node.querySelector<HTMLElement>('[aria-selected="true"]');
      if (active) {
        const width = active.offsetWidth,
          x = active.offsetLeft;
        setIndicator((old) =>
          old.width === width && old.x === x ? old : { width, x },
        );
        const dimensions = [
          node.clientWidth,
          ...Array.from(
            node.querySelectorAll("button"),
            (button) => `${button.offsetLeft}:${button.offsetWidth}`,
          ),
        ].join(",");
        if (geometry && geometry !== dimensions) {
          const focused = document.activeElement;
          revealTab(
            document.documentElement.dataset.input === "keyboard" &&
              focused instanceof HTMLElement &&
              node.contains(focused) &&
              focused.matches('[role="tab"]')
              ? focused
              : active,
          );
        }
        geometry = dimensions;
      }
    };
    update();
    const active = node.querySelector<HTMLElement>('[aria-selected="true"]');
    if (active) revealTab(active);
    const observer = new ResizeObserver(update);
    observer.observe(node);
    node
      .querySelectorAll("button")
      .forEach((button) => observer.observe(button));
    return () => observer.disconnect();
  }, [section, tabsNode, revealTab]);
  useLayoutEffect(() => {
    if (
      previous.current !== section &&
      document.documentElement.dataset.layout !== "phone"
    )
      window.scrollTo({
        top: scroll.current[section] ?? 0,
        behavior: "instant",
      });
    previous.current = section;
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
    onPointerDown: (e: ReactPointerEvent) =>
      contentPager.current?.swipe.onPointerDown(e),
    onPointerMove: (e: ReactPointerEvent) =>
      contentPager.current?.swipe.onPointerMove(e),
    onPointerUp: (e: ReactPointerEvent) =>
      contentPager.current?.swipe.onPointerUp(e),
    onPointerCancel: () => contentPager.current?.reset(),
    onClickCapture: (e: React.MouseEvent) =>
      contentPager.current?.swipe.onClickCapture(e),
  };
  const stripDrag = useRef({
    manual: false,
    touching: false,
    start: 0,
    suppress: 0,
    timer: undefined as ReturnType<typeof setTimeout> | undefined,
  });
  const latestChoose = useRef(choose);
  latestChoose.current = choose;
  const cancelStrip = () => {
    clearTimeout(stripDrag.current.timer);
    stripDrag.current.manual = false;
    stripDrag.current.touching = false;
  };
  useGestureCancellation(cancelStrip, section);
  const settleStrip = () => {
    const g = stripDrag.current,
      node = tabs.current;
    if (!g.manual || !node || Math.abs(node.scrollLeft - g.start) < 8) return;
    g.suppress = performance.now() + 350;
    clearTimeout(g.timer);
    g.timer = setTimeout(() => {
      if (!g.manual || g.touching || tabs.current !== node) return;
      g.manual = false;
      const anchor = node.scrollLeft;
      const buttons = [
        ...node.querySelectorAll<HTMLButtonElement>('[role="tab"]'),
      ];
      const target = buttons.reduce(
        (best, button) =>
          Math.abs(button.offsetLeft - anchor) <
          Math.abs(best.offsetLeft - anchor)
            ? button
            : best,
        buttons[0],
      );
      const index = buttons.indexOf(target);
      if (index >= 0) {
        latestChoose.current(librarySections[index]);
        revealTab(target);
      }
    }, 160);
  };
  const strip = {
    onTouchStart: () => {
      stripDrag.current.touching = true;
    },
    onTouchEnd: () => {
      stripDrag.current.touching = false;
      settleStrip();
    },
    onTouchCancel: cancelStrip,
    onPointerDown: (e: ReactPointerEvent) => {
      cancelStrip();
      stripDrag.current.suppress = 0;
      if (e.isPrimary && e.pointerType === "touch") {
        stripDrag.current.manual = true;
        stripDrag.current.start = tabs.current?.scrollLeft ?? 0;
      }
    },
    onScroll: settleStrip,
    onClickCapture: (e: React.MouseEvent) => {
      if (e.detail > 0 && performance.now() < stripDrag.current.suppress) {
        e.preventDefault();
        e.stopPropagation();
      }
      cancelStrip();
    },
  };
  return {
    tabs,
    panel,
    bindTabs,
    bindPanel,
    headingHeight,
    indicator,
    revealTab,
    strip,
    compact,
    choose,
    swipe,
    resetSwipe,
    contentPager,
    commit,
  };
}
