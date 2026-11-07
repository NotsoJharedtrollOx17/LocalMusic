import { useCallback, useLayoutEffect, useRef } from "react";

/** A completion belongs to the view/session that started it. */
export function useInteractionScope(key: unknown) {
  const scope = useRef({ generation: 0, active: false });
  useLayoutEffect(() => {
    const current = scope.current;
    current.generation++;
    current.active = true;
    return () => {
      current.active = false;
      current.generation++;
    };
  }, [key]);
  return useCallback(() => {
    const generation = scope.current.generation;
    return () =>
      scope.current.active && scope.current.generation === generation;
  }, []);
}
