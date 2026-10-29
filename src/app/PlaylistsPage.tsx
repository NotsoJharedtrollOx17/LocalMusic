import SearchEmpty from "./SearchEmpty";
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
  const {
    selectedList,
    generated,
    editingList,
    t,
    playlistTracks,
    inlineSearch,
  } = useMusicAppContext();

  return (
    <div className="playlists-page">
      <PlaylistToolbar />
      {selectedList ? (
        <>
          <PlaylistDetailHeading />
          {inlineSearch.active &&
          !inlineSearch.pending &&
          !inlineSearch.error &&
          inlineSearch.page?.total === 0 ? (
            <SearchEmpty />
          ) : (
            <TrackRows
              ts={playlistTracks}
              queueIds={selectedList.trackIds}
              editable={editingList && selectedList.kind !== "automatic"}
            />
          )}
          {!inlineSearch.active &&
            selectedList.kind === "automatic" &&
            !playlistTracks.length && (
              <p className="automatic-playlist-empty">{t.automaticEmpty}</p>
            )}
          <PlaylistDetailActions />
        </>
      ) : (
        <>
          {inlineSearch.active &&
          !inlineSearch.pending &&
          !inlineSearch.error &&
          inlineSearch.page?.total === 0 ? (
            <SearchEmpty />
          ) : (
            <>
              <AutomaticPlaylistCollection />
              <PlaylistCollection />
            </>
          )}
          <div hidden={inlineSearch.active}>
            <PlaylistBuilder />
            {generated && <GeneratedPlaylist />}
          </div>
        </>
      )}
    </div>
  );
}
