import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useBackLayer } from "../navigation";

export function ActionMenu({
  anchor,
  label,
  items,
  onClose,
  point,
}: {
  anchor: HTMLElement;
  label: string;
  items: Array<{ label: string; action: () => void; disabled?: boolean }>;
  onClose: () => void;
  point?: { x: number; y: number };
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: 0, top: 0 });
  useBackLayer(true, onClose);
  useLayoutEffect(() => {
    const node = ref.current!,
      r = anchor.getBoundingClientRect();
    setPos({
      left: Math.max(
        8,
        Math.min(
          point?.x ?? r.right - node.offsetWidth,
          innerWidth - node.offsetWidth - 8,
        ),
      ),
      top: Math.max(
        8,
        Math.min(point?.y ?? r.bottom + 6, innerHeight - node.offsetHeight - 8),
      ),
    });
    node
      .querySelector<HTMLButtonElement>("button:not(:disabled)")
      ?.focus({ preventScroll: true });
    return () => {
      if (anchor.isConnected)
        (anchor.matches("button,input,textarea,[tabindex]")
          ? anchor
          : anchor.querySelector<HTMLElement>(
              "button:not(:disabled),input,[tabindex]",
            )
        )?.focus({ preventScroll: true });
    };
  }, [anchor, point]);
  useEffect(() => {
    const close = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    document.addEventListener("pointerdown", close);
    const scroll = (event: Event) => {
      if (!ref.current?.contains(event.target as Node)) onClose();
    };
    window.addEventListener("resize", onClose);
    window.addEventListener("blur", onClose);
    document.addEventListener("scroll", scroll, true);
    return () => {
      document.removeEventListener("pointerdown", close);
      window.removeEventListener("resize", onClose);
      window.removeEventListener("blur", onClose);
      document.removeEventListener("scroll", scroll, true);
    };
  }, [onClose]);
  return (
    <div
      ref={ref}
      className="action-menu"
      role="menu"
      aria-label={label}
      style={pos}
      onKeyDown={(e) => {
        const buttons = Array.from(
          ref.current!.querySelectorAll<HTMLButtonElement>(
            "button:not(:disabled)",
          ),
        );
        const index = buttons.indexOf(
          document.activeElement as HTMLButtonElement,
        );
        if (["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) {
          e.preventDefault();
          buttons[
            e.key === "Home"
              ? 0
              : e.key === "End"
                ? buttons.length - 1
                : (index + (e.key === "ArrowDown" ? 1 : -1) + buttons.length) %
                  buttons.length
          ]?.focus();
        }
        if (e.key === "Tab") onClose();
      }}
    >
      {items.map((item) => (
        <button
          key={item.label}
          role="menuitem"
          disabled={item.disabled}
          onClick={() => {
            onClose();
            item.action();
          }}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
