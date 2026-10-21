import { Plus } from "lucide-react";
import { automaticPlaylistLabel } from "./automaticPlaylistLabels";
import { useMusicAppContext } from "./MusicAppContext";

export default function PlaylistToolbar() {
  const { selectedList, setManualTitle, setManualIds, setModal, t } =
    useMusicAppContext();
  return (
    <div className="library-toolbar playlist-toolbar">
      {selectedList ? (
        <h2>{automaticPlaylistLabel(selectedList, t)}</h2>
      ) : (
        <h2 id="automatic-playlists-heading">{t.automaticPlaylists}</h2>
      )}
      <div className="toolbar-actions">
        <button
          className="button primary"
          onClick={() => {
            setManualTitle("");
            setManualIds([]);
            setModal("manual");
          }}
        >
          <Plus size={18} />
          {t.newPlaylist}
        </button>
      </div>
    </div>
  );
}
