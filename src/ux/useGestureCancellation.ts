import { useLayoutEffect, useRef } from "react";

const subscribers = new Set<() => void>();
const cancelAll = () => subscribers.forEach((cancel) => cancel());
const visibility = () => {
  if (document.hidden) cancelAll();
};
// A new press supersedes any unfinished gesture, including a mouse/S Pen
// replacing a touch. Capture runs before the new target starts its gesture.
const pointer = () => cancelAll();
const ownership = new MutationObserver((records) => {
  if (records.some((record) => (record.target as HTMLElement).inert))
    cancelAll();
});

/** One shared lifecycle subscription, independent of the number of visible rows. */
export function useGestureCancellation(cancel: () => void, scope?: unknown) {
  const latest = useRef(cancel);
  latest.current = cancel;
  useLayoutEffect(() => {
    const callback = () => latest.current();
    if (!subscribers.size) {
      window.addEventListener("blur", cancelAll);
      document.addEventListener("visibilitychange", visibility);
      document.addEventListener("pointerdown", pointer, true);
      ownership.observe(document.body, {
        subtree: true,
        attributes: true,
        attributeFilter: ["inert"],
      });
    }
    subscribers.add(callback);
    return () => {
      callback();
      subscribers.delete(callback);
      if (!subscribers.size) {
        window.removeEventListener("blur", cancelAll);
        document.removeEventListener("visibilitychange", visibility);
        document.removeEventListener("pointerdown", pointer, true);
        ownership.disconnect();
      }
    };
  }, [scope]);
}
