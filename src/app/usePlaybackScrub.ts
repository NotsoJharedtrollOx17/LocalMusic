import { useEffect, useRef, useState } from "react";
import type { PlaybackSnapshot } from "../types";

const navigationKeys = new Set([
  "ArrowLeft",
  "ArrowRight",
  "ArrowUp",
  "ArrowDown",
  "Home",
  "End",
  "PageUp",
  "PageDown",
]);

/** Preview gestures locally; decoder seeks happen only after commitment. */
export function usePlaybackScrub(
  player: PlaybackSnapshot,
  seek: (ms: number) => Promise<unknown>,
) {
  const gesture = useRef<
    | {
        trackId: string | null;
        kind: "pointer" | "keyboard";
        cancelled: boolean;
        finished?: boolean;
      }
    | undefined
  >(undefined);
  const revision = useRef(0);
  const [preview, setPreview] = useState<{
    trackId: string | null;
    value: number;
  } | null>(null);
  const clamp = (value: number) =>
    Math.max(0, Math.min(value, player.durationMs));
  const position =
    preview?.trackId === player.trackId ? preview.value : player.positionMs;
  function begin(kind: "pointer" | "keyboard") {
    revision.current++;
    gesture.current = { trackId: player.trackId, kind, cancelled: false };
  }
  function cancel() {
    revision.current++;
    if (gesture.current) gesture.current.cancelled = true;
    setPreview(null);
  }
  useEffect(() => {
    const hidden = () => {
      if (document.hidden) cancel();
    };
    window.addEventListener("blur", cancel);
    document.addEventListener("visibilitychange", hidden);
    return () => {
      revision.current++;
      window.removeEventListener("blur", cancel);
      document.removeEventListener("visibilitychange", hidden);
    };
  }, []);
  async function commit(value: number) {
    if (!player.trackId || player.durationMs <= 0) return;
    const requested = ++revision.current;
    setPreview({ trackId: player.trackId, value: clamp(value) });
    try {
      await seek(clamp(value));
    } finally {
      if (revision.current === requested) setPreview(null);
    }
  }
  function finish(value: number) {
    const active = gesture.current;
    if (!active || active.finished) return;
    // Native range controls can emit change after pointerup/lost capture.
    // Retain a marker until that trailing event so it cannot seek twice.
    active.finished = true;
    if (!active.cancelled && active.trackId === player.trackId)
      void commit(value);
    else setPreview(null);
  }
  return {
    position: clamp(position),
    handlers: {
      onPointerDown: (event: React.PointerEvent<HTMLInputElement>) => {
        if (event.button !== 0) return;
        begin("pointer");
        event.currentTarget.setPointerCapture(event.pointerId);
      },
      onPointerUp: (event: React.PointerEvent<HTMLInputElement>) => {
        if (gesture.current?.kind === "pointer")
          finish(Number(event.currentTarget.value));
      },
      onPointerCancel: () => {
        cancel();
        if (gesture.current) gesture.current.finished = true;
      },
      onLostPointerCapture: () => {
        if (gesture.current?.kind === "pointer" && !gesture.current.finished) {
          cancel();
          gesture.current.finished = true;
        }
      },
      onChange: (event: React.ChangeEvent<HTMLInputElement>) => {
        if (gesture.current?.finished) {
          gesture.current = undefined;
          if (event.nativeEvent.type === "change") return;
        }
        const value = clamp(Number(event.currentTarget.value));
        if (gesture.current) {
          if (
            !gesture.current.cancelled &&
            gesture.current.trackId === player.trackId
          )
            setPreview({ trackId: player.trackId, value });
        } else void commit(value);
      },
      onKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => {
        if (event.key === "Escape" && gesture.current) {
          event.preventDefault();
          event.stopPropagation();
          cancel();
        } else if (navigationKeys.has(event.key) && !event.repeat)
          begin("keyboard");
      },
      onKeyUp: (event: React.KeyboardEvent<HTMLInputElement>) => {
        if (
          navigationKeys.has(event.key) &&
          gesture.current?.kind === "keyboard"
        )
          finish(Number(event.currentTarget.value));
      },
      onBlur: cancel,
      onFocus: () => {
        if (gesture.current?.cancelled) gesture.current = undefined;
      },
    },
  };
}
