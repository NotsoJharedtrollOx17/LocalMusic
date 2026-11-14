import { useRef } from "react";
import { useGestureCancellation } from "./useGestureCancellation";
import type { PointerEvent, MouseEvent } from "react";

export function useMiniPlayerGesture(open: () => void, trackId?: string) {
  const active = useRef<{
    id: number;
    x: number;
    y: number;
    moved: boolean;
  } | null>(null);
  const blocked = useRef(false);
  const cancel = () => {
    if (!active.current) return;
    active.current = null;
    blocked.current = true;
  };
  useGestureCancellation(cancel, trackId);
  return {
    onPointerDown: (e: PointerEvent<HTMLButtonElement>) => {
      if (e.button !== 0 || !e.isPrimary) {
        cancel();
        return;
      }
      blocked.current = false;
      active.current = {
        id: e.pointerId,
        x: e.clientX,
        y: e.clientY,
        moved: false,
      };
      if (
        e.currentTarget.hasPointerCapture(e.pointerId) ||
        e.nativeEvent.isTrusted
      )
        e.currentTarget.setPointerCapture(e.pointerId);
    },
    onPointerMove: (e: PointerEvent<HTMLButtonElement>) => {
      const g = active.current;
      if (
        g?.id === e.pointerId &&
        Math.hypot(e.clientX - g.x, e.clientY - g.y) > 10
      )
        g.moved = true;
    },
    onPointerUp: (e: PointerEvent<HTMLButtonElement>) => {
      const g = active.current;
      if (!g || g.id !== e.pointerId) return;
      active.current = null;
      const dx = Math.abs(e.clientX - g.x),
        up = g.y - e.clientY;
      blocked.current = g.moved || Math.hypot(dx, up) > 10;
      if (up > 35 && up > dx * 1.5) {
        blocked.current = true;
        e.currentTarget.focus({ preventScroll: true });
        open();
      }
    },
    onPointerCancel: cancel,
    onLostPointerCapture: cancel,
    onClick: (e: MouseEvent<HTMLButtonElement>) => {
      if (e.detail > 0 && blocked.current) {
        e.preventDefault();
        return;
      }
      open();
    },
  };
}
