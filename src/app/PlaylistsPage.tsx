import AutomaticPlaylistCollection from "./AutomaticPlaylistCollection";
import { automaticPlaylistLabel } from "./automaticPlaylistLabels";
import { Plus } from "lucide-react";
import { useMusicAppContext } from "./MusicAppContext";
import LibraryActions from "./LibraryActions";
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
          <h2>
            {selectedList
              ? automaticPlaylistLabel(selectedList, t)
              : t.playlists}
          </h2>
        </div>
        <div className="heading-actions">
          <LibraryActions />
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
      </div>
      {selectedList ? (
        <>
          <PlaylistDetailHeading />
          {
            <TrackRows
              ts={playlistTracks}
              queueIds={selectedList.trackIds}
              editable={editingList && selectedList.kind !== "automatic"}
            />
          }
          {selectedList.kind === "automatic" && !playlistTracks.length && (
            <p className="automatic-playlist-empty">{t.automaticEmpty}</p>
          )}
          <PlaylistDetailActions />
        </>
      ) : (
        <>
          <AutomaticPlaylistCollection />
          <PlaylistCollection />
          <PlaylistBuilder />
          {generated && <GeneratedPlaylist />}
        </>
      )}
    </div>
  );
}
