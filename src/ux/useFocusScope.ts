import { useEffect, useRef, type RefObject } from "react";

/** Own focus and scroll for an overlay, restoring the previous layer on exit. */
export function useFocusScope(
  ref: RefObject<HTMLElement | null>,
  active = true,
) {
  const lastFocus = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (!active) return;
    const node = ref.current;
    if (!node) return;
    // A suspended parent's old scope may have restored this host's prior inert
    // flag during the same commit. The active layer owns its availability.
    const host = node.closest<HTMLElement>(".player-scrim,.modal-scrim");
    if (host) host.inert = false;
    const previous = document.activeElement as HTMLElement | null;
    const remember = (event: FocusEvent) => {
      lastFocus.current = event.target as HTMLElement;
    };
    node.addEventListener("focusin", remember);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const background = Array.from(
      document.querySelectorAll<HTMLElement>(
        ".content-shell,.sidebar,.bottom-nav,.mini-player,.player-scrim,.modal-scrim",
      ),
    ).filter((el) => !el.contains(node));
    const prior = background.map((el) => el.inert);
    background.forEach((el) => (el.inert = true));
    const scope = () => [
      node,
      ...Array.from(
        document.querySelectorAll<HTMLElement>(
          ".error-banner,.toast:has(button)",
        ),
      ),
    ];
    const controls = () =>
      scope()
        .flatMap((el) =>
          Array.from(
            el.querySelectorAll<HTMLElement>(
              'button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href],[tabindex="0"]',
            ),
          ),
        )
        .filter((el) => el.getClientRects().length && !el.closest("[inert]"));
    (
      node.querySelector<HTMLElement>('input[type="search"]') ??
      (lastFocus.current?.isConnected ? lastFocus.current : null) ??
      controls()[0] ??
      node
    ).focus();
    const key = (event: KeyboardEvent) => {
      if (
        node.closest("[inert]") ||
        event.key !== "Tab" ||
        !scope().some((el) => el.contains(document.activeElement))
      )
        return;
      const items = controls(),
        first = items[0],
        last = items.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener("keydown", key);
    return () => {
      document.body.style.overflow = overflow;
      background.forEach((el, i) => (el.inert = prior[i]));
      document.removeEventListener("keydown", key);
      node.removeEventListener("focusin", remember);
      if (previous?.isConnected && !previous.closest("[inert]"))
        previous.focus({ preventScroll: true });
    };
  }, [ref, active]);
}
