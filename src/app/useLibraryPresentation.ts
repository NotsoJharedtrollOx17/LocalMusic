import { useRef } from "react";
import type { MusicAppModel } from "./MusicAppContext";

const containers = new Set([
  "motion",
  "motion.swipe",
  "motion.strip",
  "inlineSearch",
  "automatic",
  "soundController",
  "desktopMenu",
]);
const equalArray = (a: unknown[], b: unknown[]) =>
  a.length === b.length && a.every((v, i) => v === b[i]);

/** Progress ticks belong to transport, not every Library card and artwork. */
export function useLibraryPresentation(model: MusicAppModel): MusicAppModel {
  const latest = useRef(model);
  latest.current = model;
  const callbacks = useRef(new Map<string, (...args: unknown[]) => unknown>());
  const previous = useRef<MusicAppModel | null>(null);
  const stabilize = (
    value: Record<string, unknown>,
    old: Record<string, unknown> | null,
    prefix = "",
  ): Record<string, unknown> => {
    const result: Record<string, unknown> = {};
    for (const [key, raw] of Object.entries(value)) {
      const path = prefix ? prefix + "." + key : key;
      let next = raw;
      if (typeof raw === "function") {
        if (!callbacks.current.has(path))
          callbacks.current.set(path, (...args) => {
            const parts = path.split(".");
            let owner: unknown = latest.current;
            for (const part of parts.slice(0, -1))
              owner = (owner as Record<string, unknown>)[part];
            return (owner as Record<string, Function>)[parts.at(-1)!].apply(
              owner,
              args,
            );
          });
        next = callbacks.current.get(path);
      } else if (containers.has(path) && raw) {
        next = stabilize(
          raw as Record<string, unknown>,
          (old?.[key] as Record<string, unknown>) ?? null,
          path,
        );
      } else if (
        Array.isArray(raw) &&
        Array.isArray(old?.[key]) &&
        equalArray(raw, old[key] as unknown[])
      )
        next = old[key];
      else if (key === "player" && old?.player) {
        const a = raw as MusicAppModel["player"],
          b = old.player as MusicAppModel["player"];
        // Revision/position change continuously; all interaction-relevant fields remain authoritative.
        const comparable = (p: typeof a) =>
          JSON.stringify([
            p.trackId,
            p.playing,
            p.durationMs,
            p.queue,
            p.queueIndex,
            p.shuffle,
            p.repeat,
            p.excluded,
            p.outputMode,
            p.error,
          ]);
        if (comparable(a) === comparable(b)) next = b;
      }
      result[key] = next;
    }
    return old && Object.keys(result).every((key) => result[key] === old[key])
      ? old
      : result;
  };
  const next = stabilize(
    model as unknown as Record<string, unknown>,
    previous.current as unknown as Record<string, unknown> | null,
  ) as unknown as MusicAppModel;
  previous.current = next;
  return next;
}
