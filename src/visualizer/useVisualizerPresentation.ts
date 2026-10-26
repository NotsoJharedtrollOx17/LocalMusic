import { useEffect, useState } from "react";

/** Allow capture to warm up; retain the scene only for its brief exit fade. */
export function useVisualizerPresentation(playing: boolean) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setReady(playing), 180);
    return () => clearTimeout(timer);
  }, [playing]);
  return { ready, visible: playing && ready };
}
