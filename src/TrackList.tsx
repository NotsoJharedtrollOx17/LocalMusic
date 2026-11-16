import {
  Fragment,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type Key,
} from "react";
import {
  useVirtualizer,
  useWindowVirtualizer,
  type VirtualItem,
} from "@tanstack/react-virtual";
import { useLibraryScroll, useLibraryInitialOffset } from "./ux/libraryScroll";
const measurements = new Map<string, VirtualItem[]>();
export default function TrackList({
  count,
  render,
  virtual = true,
  estimateSize = 92,
  measurementKey,
  itemKey,
}: {
  count: number;
  render: (index: number) => ReactNode;
  virtual?: boolean;
  estimateSize?: number;
  measurementKey?: string;
  itemKey?: (index: number) => Key;
}) {
  const root = useLibraryScroll();
  const initialOffset = useLibraryInitialOffset();
  const ref = useRef<HTMLDivElement>(null);
  const [margin, setMargin] = useState(0);
  const [screens, setScreens] = useState(2);
  const [height, setHeight] = useState(innerHeight);
  const enabled = virtual && count > 40;
  useLayoutEffect(() => {
    const update = () => {
      const bounds = ref.current?.getBoundingClientRect();
      setMargin(
        (bounds?.top ?? 0) -
          (root?.getBoundingClientRect().top ?? 0) +
          (root?.scrollTop ?? window.scrollY),
      );
      setHeight(root?.clientHeight || innerHeight);
    };
    update();
    const observer = new ResizeObserver(update);
    if (ref.current?.parentElement) observer.observe(ref.current.parentElement);
    if (root) observer.observe(root);
    window.addEventListener("resize", update);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [count, enabled, root]);
  useLayoutEffect(() => {
    if (!enabled) return;
    const target = root ?? window;
    let last = root?.scrollTop ?? window.scrollY,
      time = performance.now(),
      timer: ReturnType<typeof setTimeout>;
    const scroll = () => {
      const now = performance.now(),
        position = root?.scrollTop ?? window.scrollY;
      const velocity = Math.abs(position - last) / Math.max(1, now - time);
      last = position;
      time = now;
      setScreens(velocity > 2 ? 5 : velocity > 0.7 ? 3 : 2);
      clearTimeout(timer);
      timer = setTimeout(() => setScreens(2), 160);
    };
    target.addEventListener("scroll", scroll, { passive: true });
    return () => {
      target.removeEventListener("scroll", scroll);
      clearTimeout(timer);
    };
  }, [enabled, root]);
  const options = {
    count: enabled ? count : 0,
    estimateSize: () => estimateSize,
    getItemKey: itemKey,
    initialMeasurementsCache: measurementKey
      ? measurements.get(measurementKey)
      : undefined,
    overscan: Math.ceil(height / estimateSize) * screens,
    scrollMargin: margin,
    initialOffset: () =>
      root ? root.scrollTop || initialOffset : window.scrollY,
    initialRect: root
      ? { width: root.clientWidth, height: root.clientHeight }
      : undefined,
  };
  const elementList = useVirtualizer({
    ...options,
    getScrollElement: () => root,
    enabled: enabled && !!root,
  });
  const windowList = useWindowVirtualizer({
    ...options,
    enabled: enabled && !root,
  });
  const list = root ? elementList : windowList;
  useLayoutEffect(
    () => () => {
      if (measurementKey && enabled) {
        measurements.set(measurementKey, list.takeSnapshot());
        while (measurements.size > 24)
          measurements.delete(measurements.keys().next().value!);
      }
    },
    [measurementKey, enabled, list],
  );
  if (!enabled)
    return (
      <div className="track-list" ref={ref}>
        {Array.from({ length: count }, (_, i) => (
          <Fragment key={itemKey?.(i) ?? i}>{render(i)}</Fragment>
        ))}
      </div>
    );
  return (
    <div
      className="track-list"
      data-virtual-count={count}
      ref={ref}
      style={{ height: list.getTotalSize(), position: "relative" }}
    >
      {list.getVirtualItems().map((row) => (
        <div
          key={row.key}
          data-index={row.index}
          data-library-key={String(row.key)}
          ref={list.measureElement}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            transform: `translateY(${row.start - margin}px)`,
          }}
        >
          {render(row.index)}
        </div>
      ))}
    </div>
  );
}
