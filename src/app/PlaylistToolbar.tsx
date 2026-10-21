import { Plus } from "lucide-react";
import { automaticPlaylistLabel } from "./automaticPlaylistLabels";
import { useMusicAppContext } from "./MusicAppContext";
import CollectionCountHeading from "./CollectionCountHeading";

export default function PlaylistToolbar() {
  const {
    selectedList,
    lists,
    automatic,
    playlistsReady,
    setManualTitle,
    setManualIds,
    setModal,
    t,
  } = useMusicAppContext();
  return (
    <div className="library-toolbar playlist-toolbar">
      {selectedList ? (
        <h2>{automaticPlaylistLabel(selectedList, t)}</h2>
      ) : (
        <CollectionCountHeading
          id="automatic-playlists-heading"
          kind="playlists"
          count={
            playlistsReady && !automatic.loading && !automatic.error
              ? new Set([...lists, ...automatic.playlists].map((p) => p.id))
                  .size
              : null
          }
        />
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
