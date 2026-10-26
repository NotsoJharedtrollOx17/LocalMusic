import { useEffect, useRef, useState } from "react";
import { api, native } from "../api";
import type { VisualizerFrame, VisualizerMode } from "./types";
import { VisualizerRenderer } from "./renderer";

export function useVisualizer(
  mode: VisualizerMode,
  playing: boolean,
  sceneReady: boolean,
  gentleMotion: boolean,
) {
  const canvas = useRef<HTMLCanvasElement>(null),
    latest = useRef({ mode, playing, sceneReady, gentleMotion });
  latest.current = { mode, playing, sceneReady, gentleMotion };
  const [error, setError] = useState(false),
    [retry, setRetry] = useState(0);
  useEffect(() => {
    let disposed = false,
      serial = 0,
      session: string | undefined,
      timer: ReturnType<typeof setTimeout> | undefined,
      raf = 0,
      frame: VisualizerFrame | null = null;
    let minimized = false;
    let forceDraw = true;
    const unlisten: Array<() => void> = [];
    let renderer: VisualizerRenderer;
    let last = 0,
      generation = 0,
      sequence = 0;
    let wake: WakeLockSentinel | undefined,
      wakePending = false,
      wakeAttempted = false;
    let lastFrame = performance.now();
    const releaseWake = () => {
      void wake?.release().catch(() => {});
      wake = undefined;
    };
    const updateWake = () => {
      if (document.hidden || !latest.current.playing) {
        wakeAttempted = false;
        releaseWake();
        return;
      }
      if (
        !native &&
        !wake &&
        !wakePending &&
        !wakeAttempted &&
        navigator.wakeLock
      ) {
        wakeAttempted = true;
        wakePending = true;
        void navigator.wakeLock
          .request("screen")
          .then((w) => {
            if (disposed || document.hidden || !latest.current.playing)
              void w.release();
            else wake = w;
          })
          .catch(() => {})
          .finally(() => {
            wakePending = false;
          });
      }
    };
    const stop = () => {
      serial++;
      clearTimeout(timer);
      cancelAnimationFrame(raf);
      releaseWake();
      frame = null;
      if (session) {
        void api.stopVisualizer(session).catch(() => {});
        session = undefined;
      }
    };
    const draw = (now: number) => {
      raf = 0;
      if (disposed || document.hidden || minimized) return;
      const dt = Math.min(0.1, (now - last) / 1000);
      if (forceDraw || now - last >= 1000 / renderer.fps - 1) {
        forceDraw = false;
        try {
          renderer.draw(
            latest.current.mode,
            latest.current.playing ? frame : null,
            dt || 1 / 60,
            true,
            now,
            latest.current.sceneReady,
            latest.current.gentleMotion,
          );
        } catch {
          stop();
          setError(true);
          return;
        }
        last = now;
      }
      // Stop drawing once the scene has cleared or silent audio has settled.
      if (
        (latest.current.playing && (frame?.rms ?? 0) > 0.0001) ||
        renderer.moving
      )
        raf = requestAnimationFrame(draw);
    };
    const read = async (token: number) => {
      if (disposed || token !== serial || !session) return;
      try {
        const next = await api.readVisualizer(session);
        if (disposed || token !== serial) return;
        if (next || !latest.current.playing) lastFrame = performance.now();
        else if (performance.now() - lastFrame > 2500)
          throw new Error("No audio analysis frames");
        if (
          next &&
          (next.generation > generation ||
            (next.generation === generation && next.sequence > sequence))
        ) {
          if (next.generation !== generation) frame = null;
          generation = next.generation;
          sequence = next.sequence;
          frame = next;
          if (!raf && latest.current.playing && next.rms > 0.0001)
            raf = requestAnimationFrame(draw);
        } else if (!next) frame = null;
        updateWake();
        timer = setTimeout(() => void read(token), 1000 / 30);
      } catch {
        if (token === serial && !disposed) {
          stop();
          setError(true);
        }
      }
    };
    const start = async () => {
      stop();
      if (disposed || document.hidden || minimized) return;
      const token = serial;
      setError(false);
      try {
        const result = await api.startVisualizer();
        if (disposed || token !== serial) {
          void api.stopVisualizer(result.id);
          return;
        }
        session = result.id;
        generation = sequence = 0;
        last = performance.now();
        lastFrame = last;
        renderer.resize();
        forceDraw = true;
        raf = requestAnimationFrame(draw);
        void read(token);
      } catch {
        if (!disposed && token === serial) setError(true);
      }
    };
    const visibility = () => {
      if (document.hidden) stop();
      else void start();
    };
    const redraw = () => {
      const theme = document.documentElement.dataset.theme;
      renderer.setTheme(
        theme === "dark" ||
          ((theme === "system" || !theme) && colorScheme.matches),
      );
      renderer.resize();
      forceDraw = true;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(draw);
    };
    try {
      renderer = new VisualizerRenderer(canvas.current!);
    } catch {
      setError(true);
      return;
    }
    const observer = new ResizeObserver(redraw);
    const colorScheme = matchMedia("(prefers-color-scheme: dark)");
    const themeObserver = new MutationObserver(redraw);
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    colorScheme.addEventListener("change", redraw);
    redraw();
    observer.observe(canvas.current!);
    document.addEventListener("visibilitychange", visibility);
    // State updates are signaled without tearing down the analysis session.
    window.addEventListener("visualizer-state", redraw);
    if (native)
      void import("@tauri-apps/api/window")
        .then(async ({ getCurrentWindow }) => {
          const win = getCurrentWindow();
          const changed = async () => {
            const hidden = await win.isMinimized().catch(() => false);
            if (disposed) return;
            if (hidden && !minimized) {
              minimized = true;
              stop();
            } else if (!hidden && minimized) {
              minimized = false;
              void start();
            }
          };
          for (const register of [
            () => win.onFocusChanged(() => void changed()),
            () => win.onResized(() => void changed()),
          ]) {
            try {
              const off = await register();
              if (disposed) off();
              else unlisten.push(off);
            } catch {
              /* Android uses document visibility. */
            }
          }
        })
        .catch(() => {});
    void start();
    return () => {
      disposed = true;
      stop();
      observer.disconnect();
      themeObserver.disconnect();
      colorScheme.removeEventListener("change", redraw);
      unlisten.forEach((off) => off());
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("visualizer-state", redraw);
    };
  }, [retry]);
  useEffect(() => {
    window.dispatchEvent(new Event("visualizer-state"));
  }, [mode, playing, sceneReady, gentleMotion]);
  return { canvas, error, retry: () => setRetry((n) => n + 1) };
}
