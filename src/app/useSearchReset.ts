import { useLayoutEffect, useRef, useState } from "react";

/** A clear-only handoff; typing and navigation never wait for animation. */
export function useSearchReset(key: string, scope: string) {
  const [phase, setPhase] = useState<"" | "out" | "in">("");
  const state = useRef({
    key,
    scope,
    phase,
    timer: undefined as ReturnType<typeof setTimeout> | undefined,
  });
  const latest = useRef(key);
  latest.current = key;
  const update = (next: typeof phase) => {
    state.current.phase = next;
    setPhase(next);
  };
  useLayoutEffect(() => {
    const current = state.current;
    if (
      current.scope !== scope ||
      (current.phase === "out" && current.key !== key)
    ) {
      clearTimeout(current.timer);
      update("");
    }
    current.scope = scope;
  }, [key, scope]);
  useLayoutEffect(() => () => clearTimeout(state.current.timer), []);
  const run = (action: () => void, active: boolean) => {
    if (state.current.phase === "out") return;
    clearTimeout(state.current.timer);
    if (!active || matchMedia("(prefers-reduced-motion: reduce)").matches) {
      update("");
      action();
      return;
    }
    state.current.key = key;
    update("out");
    state.current.timer = setTimeout(() => {
      if (latest.current !== key) {
        update("");
        return;
      }
      update("in");
      action();
      state.current.timer = setTimeout(() => update(""), 150);
    }, 90);
  };
  return { phase, run };
}
