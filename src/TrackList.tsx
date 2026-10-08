import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { useWindowVirtualizer } from "@tanstack/react-virtual";
export default function TrackList({
  count,
  render,
  virtual = true,
}: {
  count: number;
  render: (index: number) => ReactNode;
  virtual?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [margin, setMargin] = useState(0);
  const enabled = virtual && count > 40;
  useLayoutEffect(() => {
    const update = () =>
      setMargin(
        (ref.current?.getBoundingClientRect().top ?? 0) + window.scrollY,
      );
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [count, enabled]);
  const list = useWindowVirtualizer({
    count: enabled ? count : 0,
    estimateSize: () => 92,
    overscan: 6,
    scrollMargin: margin,
    enabled,
  });
  if (!enabled)
    return (
      <div className="track-list" ref={ref}>
        {Array.from({ length: count }, (_, i) => render(i))}
      </div>
    );
  return (
    <div
      className="track-list"
      ref={ref}
      style={{ height: list.getTotalSize(), position: "relative" }}
    >
      {list.getVirtualItems().map((row) => (
        <div
          key={row.key}
          data-index={row.index}
          ref={list.measureElement}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            transform: "translateY(" + (row.start - margin) + "px)",
          }}
        >
          {render(row.index)}
        </div>
      ))}
    </div>
  );
}
