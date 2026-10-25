import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useBackLayer } from "../navigation";
import { claimMenu, consumeDismissalClick } from "./menuLayer";

export interface MenuAction {
  id: string;
  label: string;
  action: () => void;
  disabled?: boolean;
  disabledReason?: string;
  checked?: boolean;
  checkType?: "radio" | "checkbox";
  keepOpen?: boolean;
  busy?: boolean;
  danger?: boolean;
}

export function ActionMenu({
  anchor,
  label,
  items,
  onClose,
  point,
}: {
  anchor: HTMLElement;
  label: string;
  items: MenuAction[];
  onClose: () => void;
  point?: { x: number; y: number };
}) {
  const ref = useRef<HTMLDivElement>(null);
  const latestClose = useRef(onClose);
  latestClose.current = onClose;
  const anchorBounds = useRef<DOMRect | null>(null);
  const [pos, setPos] = useState({ left: 0, top: 0 });
  const restore = () => {
    const target = anchor.matches("button,input,textarea,[tabindex]")
      ? anchor
      : anchor.querySelector<HTMLElement>(
          "button:not(:disabled),input,[tabindex]",
        );
    const fallback = document.querySelector<HTMLElement>(
      ".library-page h1,.library-navigation button",
    );
    if (target?.isConnected && !target.closest("[inert]"))
      target.focus({ preventScroll: true });
    else fallback?.focus({ preventScroll: true });
  };
  useBackLayer(true, () => {
    restore();
    latestClose.current();
  });
  useLayoutEffect(() => {
    const node = ref.current!;
    const release = claimMenu({ close: () => latestClose.current() });
    const opener = anchor.matches('[aria-haspopup="menu"]');
    if (opener) anchor.setAttribute("aria-expanded", "true");
    const selected = node.querySelector<HTMLButtonElement>(
      'button[role="menuitemradio"][aria-checked="true"]:not([aria-disabled="true"])',
    );
    (selected ?? node.querySelector<HTMLButtonElement>("button"))?.focus({
      preventScroll: true,
    });
    return () => {
      release();
      if (opener) anchor.setAttribute("aria-expanded", "false");
    };
  }, [anchor, point]);
  useLayoutEffect(() => {
    const node = ref.current!,
      r = anchor.getBoundingClientRect();
    anchorBounds.current = r;
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
  }, [anchor, point, items.length]);
  useEffect(() => {
    const close = (event: PointerEvent) => {
      if (ref.current?.contains(event.target as Node)) return;
      const opener = (event.target as Element).closest?.(
        '[aria-haspopup="menu"]',
      );
      if (!opener && event.button === 0) {
        event.preventDefault();
        event.stopImmediatePropagation();
        consumeDismissalClick();
        restore();
      }
      latestClose.current();
    };
    const scroll = (event: Event) => {
      if (ref.current?.contains(event.target as Node)) return;
      const before = anchorBounds.current,
        now = anchor.getBoundingClientRect();
      if (
        !before ||
        !anchor.isConnected ||
        Math.abs(now.top - before.top) > 0.5 ||
        Math.abs(now.left - before.left) > 0.5
      )
        latestClose.current();
    };
    const closeWithoutRestore = () => latestClose.current();
    document.addEventListener("pointerdown", close, true);
    window.addEventListener("resize", closeWithoutRestore);
    window.addEventListener("blur", closeWithoutRestore);
    document.addEventListener("scroll", scroll, true);
    const observer = new MutationObserver(() => {
      if (!anchor.isConnected || anchor.closest("[inert]")) {
        if (
          !anchor.isConnected &&
          ref.current?.contains(document.activeElement)
        )
          restore();
        closeWithoutRestore();
      }
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["inert"],
    });
    return () => {
      observer.disconnect();
      document.removeEventListener("pointerdown", close, true);
      window.removeEventListener("resize", closeWithoutRestore);
      window.removeEventListener("blur", closeWithoutRestore);
      document.removeEventListener("scroll", scroll, true);
    };
  }, [anchor, point]);
  return (
    <div
      ref={ref}
      className="action-menu"
      role="menu"
      aria-label={label}
      style={pos}
      onKeyDown={(event) => {
        const buttons = Array.from(
          ref.current!.querySelectorAll<HTMLButtonElement>("button"),
        );
        const index = buttons.indexOf(
          document.activeElement as HTMLButtonElement,
        );
        if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
          event.preventDefault();
          buttons[
            event.key === "Home"
              ? 0
              : event.key === "End"
                ? buttons.length - 1
                : (index +
                    (event.key === "ArrowDown" ? 1 : -1) +
                    buttons.length) %
                  buttons.length
          ]?.focus();
        }
        if (event.key === "Tab") {
          event.preventDefault();
          restore();
          latestClose.current();
          const scope =
            anchor.closest('[role="dialog"],.search-surface') ?? document.body;
          const controls = Array.from(
            scope.querySelectorAll<HTMLElement>(
              'button:not(:disabled),input:not(:disabled),textarea:not(:disabled),select:not(:disabled),a[href],[tabindex="0"]',
            ),
          ).filter(
            (el) =>
              !el.closest(".action-menu,[inert]") && el.getClientRects().length,
          );
          const origin = controls.indexOf(
            document.activeElement as HTMLElement,
          );
          controls[
            (origin + (event.shiftKey ? -1 : 1) + controls.length) %
              controls.length
          ]?.focus({ preventScroll: true });
        }
      }}
    >
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          tabIndex={-1}
          role={
            item.checked === undefined
              ? "menuitem"
              : item.checkType === "checkbox"
                ? "menuitemcheckbox"
                : "menuitemradio"
          }
          aria-checked={item.checked}
          aria-disabled={item.disabled || undefined}
          aria-busy={item.busy || undefined}
          aria-description={item.disabled ? item.disabledReason : undefined}
          title={item.disabled ? item.disabledReason : undefined}
          className={item.danger ? "menu-danger" : undefined}
          onClick={() => {
            if (item.disabled) return;
            // Capture the opener as the child's return target before it mounts.
            if (!item.keepOpen) {
              restore();
              latestClose.current();
            }
            item.action();
          }}
        >
          {item.label}
          {item.checkType === "checkbox" && (
            <span aria-hidden="true">{item.checked ? "✓" : ""}</span>
          )}
        </button>
      ))}
    </div>
  );
}
