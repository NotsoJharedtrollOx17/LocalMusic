import { SearchSurface } from "../ux";
import { api } from "../api";
import { useMusicAppContext } from "./MusicAppContext";

export default function SearchOverlay() {
  const {
    setSection,
    searchOpen,
    setSearchOpen,
    catalogRevision,
    setMenu,
    t,
    act,
    remember,
    favorite,
    closeGroup,
    openGroup,
    openPlaylist,
  } = useMusicAppContext();

  return (
    <>
      {searchOpen && (
        <SearchSurface
          onFavorite={favorite}
          revision={catalogRevision}
          rowLabels={t}
          labels={{
            search: t.searchHint,
            close: t.close,
            songs: t.songs,
            albums: t.albums,
            artists: t.artists,
            playlists: t.playlists,
            loading: t.loadingLibrary,
            empty: t.searchEmpty,
            more: t.loadMore,
          }}
          onClose={() => setSearchOpen(false)}
          onGroup={(kind, g) => {
            setSearchOpen(false);
            openGroup(kind, g);
          }}
          onPlaylist={(p) => {
            setSearchOpen(false);
            closeGroup();
            setSection("playlists");
            void openPlaylist(p);
          }}
          onPlay={(ids, index) =>
            void act(async () => {
              remember(await api.tracksById(ids));
              await api.play(ids, index);
            })
          }
          onMore={(track, anchor) => {
            remember([track]);
            setMenu({ track, anchor });
          }}
        />
      )}
    </>
  );
}
