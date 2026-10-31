import { useEffect } from "react";
import type { Settings } from "../types";
import { PlayerContext } from "../app/PlayerContext";
import { useCompanionPlayer } from "./useCompanionPlayer";
import type { DetachedView } from "./windows";
import PlayerDialog from "../app/PlayerDialog";
import VisualizerView from "../app/VisualizerView";
import AppFeedback from "../app/AppFeedback";
import TrackActionMenu from "../app/TrackActionMenu";
import TrackDetailsDialog from "../app/TrackDetailsDialog";
import AddPlaylistDialog from "../app/AddPlaylistDialog";
import ManualPlaylistDialog from "../app/ManualPlaylistDialog";
import RemoveLibraryDialog from "../app/RemoveLibraryDialog";
import SoundDialog from "../app/SoundDialog";
import WindowControls from "./WindowControls";
import DetachedEqualizer from "./DetachedEqualizer";
export default function CompanionApp({
  view,
  initialSettings,
}: {
  view: DetachedView;
  initialSettings?: Settings;
}) {
  const { model, active, loaded } = useCompanionPlayer(view, initialSettings);
  useEffect(() => {
    if (active)
      requestAnimationFrame(() =>
        document
          .querySelector<HTMLButtonElement>(
            ".player-surface-head button,.visualizer-header button,.detached-equalizer-header button,.companion-wait button",
          )
          ?.focus(),
      );
  }, [active]);
  return (
    <PlayerContext.Provider value={model}>
      <div className="companion-shell">
        {active && loaded ? (
          <>
            {view === "equalizer" ? (
              <DetachedEqualizer />
            ) : model.current ? (
              <>{view === "player" ? <PlayerDialog /> : <VisualizerView />}</>
            ) : (
              <main className="companion-wait">
                <p>{model.t.waitingForTrack}</p>
                <WindowControls view={view} />
              </main>
            )}
            <TrackActionMenu />
            <TrackDetailsDialog />
            <AddPlaylistDialog />
            <ManualPlaylistDialog />
            <RemoveLibraryDialog />
            {view !== "equalizer" && <SoundDialog />}
          </>
        ) : (
          <main className="companion-wait" role="status">
            {model.t.loading}
          </main>
        )}
        <AppFeedback />
      </div>
    </PlayerContext.Provider>
  );
}
