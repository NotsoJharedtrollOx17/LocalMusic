import type { Settings } from "./types";
import { useMusicApp } from "./app/useMusicApp";
import { MusicAppContext } from "./app/MusicAppContext";
import Sidebar from "./app/Sidebar";
import AppContent from "./app/AppContent";
import MiniPlayer from "./app/MiniPlayer";
import ImportInputs from "./app/ImportInputs";
import AppFeedback from "./app/AppFeedback";
import SearchOverlay from "./app/SearchOverlay";
import TrackActionMenu from "./app/TrackActionMenu";
import AppContextMenu from "./app/AppContextMenu";
import RemoveLibraryDialog from "./app/RemoveLibraryDialog";
import AddPlaylistDialog from "./app/AddPlaylistDialog";
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
        <Sidebar />
        <AppContent />
        <MiniPlayer />
        <ImportInputs />
        <AppFeedback />
        <SearchOverlay />
        <TrackActionMenu />
        <AppContextMenu />
        <RemoveLibraryDialog />
        <AddPlaylistDialog />
        <SoundDialog />
        <SettingsDialog />
        <PlayerDialog />
        <ManualPlaylistDialog />
        <TrackDetailsDialog />
        <SnapshotsDialog />
        <RecapExportDialog />
        <RecapStoryDialog />
      </div>
    </MusicAppContext.Provider>
  );
}
