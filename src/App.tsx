import OrganizationDialog from "./app/OrganizationDialog";
import type { Settings } from "./types";
import { useMusicApp } from "./app/useMusicApp";
import { MusicAppContext } from "./app/MusicAppContext";
import AppContent from "./app/AppContent";
import DesktopMenuDialogs from "./app/DesktopMenuDialogs";
import DesktopMenuFeedback from "./app/DesktopMenuFeedback";
import MiniPlayer from "./app/MiniPlayer";
import ImportInputs from "./app/ImportInputs";
import AppFeedback from "./app/AppFeedback";
import TrackActionMenu from "./app/TrackActionMenu";
import AppContextMenu from "./app/AppContextMenu";
import RemoveLibraryDialog from "./app/RemoveLibraryDialog";
import AddPlaylistDialog from "./app/AddPlaylistDialog";
import VisualizerView from "./app/VisualizerView";
import SoundDialog from "./app/SoundDialog";
import SettingsDialog from "./app/SettingsDialog";
import PlayerDialog from "./app/PlayerDialog";
import ManualPlaylistDialog from "./app/ManualPlaylistDialog";
import TrackDetailsDialog from "./app/TrackDetailsDialog";
import SnapshotsDialog from "./app/SnapshotsDialog";
import RecapExportDialog from "./app/RecapExportDialog";
import RecapStoryDialog from "./app/RecapStoryDialog";

export default function App({
  initialSettings,
}: {
  initialSettings?: Settings;
}) {
  const model = useMusicApp(initialSettings);
  return (
    <MusicAppContext.Provider value={model}>
      <div className="app-shell">
        <AppContent />
        <MiniPlayer />
        <ImportInputs />
        <AppFeedback />
        <DesktopMenuFeedback />
        <DesktopMenuDialogs />
        <TrackActionMenu />
        <AppContextMenu />
        <RemoveLibraryDialog />
        <AddPlaylistDialog />
        <SoundDialog />
        <VisualizerView />
        <SettingsDialog />
        <PlayerDialog />
        <ManualPlaylistDialog />
        <TrackDetailsDialog />
        <OrganizationDialog />
        <SnapshotsDialog />
        <RecapExportDialog />
        <RecapStoryDialog />
      </div>
    </MusicAppContext.Provider>
  );
}
