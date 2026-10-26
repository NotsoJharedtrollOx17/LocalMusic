import { useEffect, useState } from "react";

/** Warm up on start/resume; keep the canvas mounted for mode-specific settling. */
export function useVisualizerPresentation(playing: boolean) {
  const [ready, setReady] = useState(false);
  const [running, setRunning] = useState(false);
  useEffect(() => {
    if (!playing) {
      setRunning(false);
      return;
    }
    const timer = setTimeout(() => {
      setReady(true);
      setRunning(true);
    }, 180);
    return () => clearTimeout(timer);
  }, [playing]);
  return { ready, visible: ready, running: playing && running };
}
