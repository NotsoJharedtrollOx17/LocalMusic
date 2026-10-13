import PlaylistToolbar from "./PlaylistToolbar";
import AutomaticPlaylistCollection from "./AutomaticPlaylistCollection";
import { useMusicAppContext } from "./MusicAppContext";
import TrackRows from "./TrackRows";
import PlaylistBuilder from "./PlaylistBuilder";
import GeneratedPlaylist from "./GeneratedPlaylist";
import PlaylistCollection from "./PlaylistCollection";
import PlaylistDetailHeading from "./PlaylistDetailHeading";
import PlaylistDetailActions from "./PlaylistDetailActions";

export default function PlaylistsPage() {
  const { selectedList, generated, editingList, t, playlistTracks } =
    useMusicAppContext();

  return (
    <div className="playlists-page">
      <PlaylistToolbar />
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
