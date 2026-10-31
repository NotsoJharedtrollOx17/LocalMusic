import WindowControls from "../desktop/WindowControls";
import { companionView } from "../desktop/windows";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Play, Pause, SkipBack, SkipForward } from "lucide-react";
import { usePlayerContext } from "./PlayerContext";
import { useVisualizer } from "../visualizer/useVisualizer";
import { useVisualizerPresentation } from "../visualizer/useVisualizerPresentation";
import { useFocusScope } from "../ux/useFocusScope";
import { useBackLayer } from "../navigation";
import { IconButton } from "../components";
import { api } from "../api";
import PlaybackProgress from "./PlaybackProgress";
import type { VisualizerMode } from "../visualizer/types";

export default function VisualizerScene() {
  const { setModal, settings, setSettings, t, current, player, act } =
    usePlayerContext();
  const [mode, setMode] = useState<VisualizerMode>(
    settings?.visualizerMode ?? "spectrum",
  );
  const [reduced, setReduced] = useState(
      () => matchMedia("(prefers-reduced-motion: reduce)").matches,
    ),
    [idle, setIdle] = useState(false);
  useEffect(
    () => setMode(settings?.visualizerMode ?? "spectrum"),
    [settings?.visualizerMode],
  );
  const presentation = useVisualizerPresentation(player.playing);
  const view = useVisualizer(
      mode,
      player.playing,
      presentation.ready,
      reduced,
      presentation.running,
    ),
    root = useRef<HTMLDivElement>(null),
    timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useFocusScope(root, !companionView);
  useBackLayer(true, () => setModal(null));
  const reveal = () => {
    setIdle(false);
    clearTimeout(timer.current);
    if (player.playing && !reduced)
      timer.current = setTimeout(() => setIdle(true), 3000);
  };
  useEffect(() => {
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    const change = () => {
      setReduced(media.matches);
    };
    media.addEventListener("change", change);
    return () => media.removeEventListener("change", change);
  }, []);
  useEffect(() => {
    reveal();
    return () => clearTimeout(timer.current);
  }, [player.playing, reduced]);
  const choose = (value: VisualizerMode) => {
    setMode(value);
    setSettings((s) => (s ? { ...s, visualizerMode: value } : s));
  };
  return (
    <div
      ref={root}
      className={`visualizer-view${idle && !view.error ? " controls-idle" : ""}`}
      data-scene-visible={presentation.visible}
      data-motion={reduced ? "gentle" : "full"}
      role="dialog"
      aria-modal={companionView ? undefined : true}
      aria-label={t.visualizer}
      onPointerMove={reveal}
      onPointerDown={reveal}
      onKeyDown={reveal}
    >
      <canvas ref={view.canvas} aria-hidden="true" />
      <header className="visualizer-controls visualizer-header">
        <IconButton label={t.back} onClick={() => setModal(null)}>
          <ArrowLeft />
        </IconButton>
        <div
          className="visualizer-modes"
          role="group"
          aria-label={t.visualizerMode}
        >
          {(["spectrum", "geometry", "xmb"] as const).map((m) => (
            <button key={m} aria-pressed={mode === m} onClick={() => choose(m)}>
              {t[m]}
            </button>
          ))}
        </div>
        <div className="visualizer-window-actions">
          <WindowControls view="visualizer" />
        </div>
      </header>
      {view.error && (
        <div className="visualizer-error" role="status">
          <p>{t.visualizerError}</p>
          <button
            className="button"
            onClick={() => {
              root.current
                ?.querySelector<HTMLButtonElement>(".visualizer-header button")
                ?.focus();
              reveal();
              view.retry();
            }}
          >
            {t.retry}
          </button>
        </div>
      )}
      <footer className="visualizer-controls visualizer-footer">
        <h2>{current?.title ?? t.nowPlaying}</h2>
        <p>{current?.artist ?? t.unknownArtist}</p>
        <PlaybackProgress />
        <div className="transport">
          <IconButton
            label={t.previous}
            onClick={() => void act(() => api.previous())}
          >
            <SkipBack fill="currentColor" />
          </IconButton>
          <button
            className="play-circle"
            aria-label={player.playing ? t.pause : t.play}
            onClick={() => void act(() => api.toggle())}
          >
            {player.playing ? (
              <Pause fill="currentColor" />
            ) : (
              <Play fill="currentColor" />
            )}
          </button>
          <IconButton label={t.next} onClick={() => void act(() => api.next())}>
            <SkipForward fill="currentColor" />
          </IconButton>
        </div>
      </footer>
    </div>
  );
}
