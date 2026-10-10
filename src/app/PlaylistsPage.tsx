import { Plus } from "lucide-react";
import { useMusicAppContext } from "./MusicAppContext";
import TrackRows from "./TrackRows";
import PlaylistBuilder from "./PlaylistBuilder";
import GeneratedPlaylist from "./GeneratedPlaylist";
import PlaylistCollection from "./PlaylistCollection";
import PlaylistDetailHeading from "./PlaylistDetailHeading";
import PlaylistDetailActions from "./PlaylistDetailActions";

export default function PlaylistsPage() {
  const {
    selectedList,
    generated,
    setModal,
    setManualTitle,
    setManualIds,
    editingList,
    t,
    playlistTracks,
  } = useMusicAppContext();

  return (
    <div className="playlists-page">
      <div className="page-heading">
        <div>
          <h2>{selectedList ? selectedList.title : t.playlists}</h2>
        </div>
        <button
          className="button secondary"
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
      {selectedList ? (
        <>
          <PlaylistDetailHeading />
          {
            <TrackRows
              ts={playlistTracks}
              queueIds={selectedList.trackIds}
              editable={editingList}
            />
          }
          <PlaylistDetailActions />
        </>
      ) : (
        <>
          <PlaylistCollection />
          <PlaylistBuilder />
          {generated && <GeneratedPlaylist />}
        </>
      )}
    </div>
  );
}
