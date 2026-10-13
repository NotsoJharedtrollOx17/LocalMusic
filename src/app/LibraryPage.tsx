import { LoaderCircle, Search, ArrowLeft } from "lucide-react";
import LibraryActions from "./LibraryActions";
import { api } from "../api";
import { Cover, IconButton } from "../components";
import { useMusicAppContext } from "./MusicAppContext";
import TrackRows from "./TrackRows";
import PlaylistsPage from "./PlaylistsPage";
import LibraryToolbar from "./LibraryToolbar";
import EmptyLibrary from "./EmptyLibrary";
import SelectionToolbar from "./SelectionToolbar";
import LibraryTabs from "./LibraryTabs";
import YourYearPage from "./YourYearPage";

export default function LibraryPage() {
  const {
    section,
    tracks,
    total,
    query,
    searchOpen,
    setSearchOpen,
    group,
    groupTracks,
    setGroupTracks,
    groupLoading,
    selectedGroupPage,
    catalogGroups,
    groupsTotal,
    libraryLoading,
    selectionMode,
    artistView,
    setArtistView,
    artistAlbums,
    artistAlbumsLoading,
    detailHero,
    motion,
    t,
    formatMusicCount,
    act,
    remember,
    groupRequest,
    refresh,
    refreshGroups,
    backGroup,
    openGroup,
    visible,
  } = useMusicAppContext();

  return (
    <section
      ref={motion.bindPanel}
      style={
        {
          "--library-heading-height": motion.headingHeight + "px",
        } as React.CSSProperties
      }
      {...(!group && !selectionMode ? motion.swipe : {})}
      className={"library-page" + (motion.compact ? " is-compact" : "")}
    >
      <div className="page-heading library-navigation">
        {group ? <h1 tabIndex={-1}>{group.title}</h1> : <LibraryTabs />}
        <div className="heading-actions">
          <IconButton
            label={t.search}
            onClick={() => setSearchOpen(!searchOpen)}
          >
            <Search size={25} />
          </IconButton>
          <LibraryActions />
        </div>
      </div>
      {group ? (
        <button className="text-button group-back" onClick={backGroup}>
          <ArrowLeft size={17} />
          {t.library}
        </button>
      ) : null}
      <div
        id="library-content"
        role={!group ? "tabpanel" : undefined}
        aria-labelledby={!group ? "tab-" + section : undefined}
      >
        {group && (
          <div className="collection-hero">
            <Cover imageRef={detailHero} track={group.coverTrack} large />
            <div>
              <strong>{group.title}</strong>
              <span>
                {group.subtitle || formatMusicCount(group.ids.length)}
              </span>
            </div>
          </div>
        )}
        {group?.kind === "artists" && (
          <div className="artist-view" role="tablist" aria-label={t.artists}>
            {(["tracks", "albums"] as const).map((view) => (
              <button
                key={view}
                role="tab"
                aria-selected={artistView === view}
                onClick={() => setArtistView(view)}
              >
                {view === "tracks" ? t.songs : t.albums}
              </button>
            ))}
          </div>
        )}
        {selectionMode && <SelectionToolbar />}
        {section === "year" ? (
          <YourYearPage />
        ) : section === "playlists" ? (
          <PlaylistsPage />
        ) : (
          <>
            <LibraryToolbar />

            {libraryLoading && total === 0 ? (
              <div className="catalog-loading" role="status">
                <LoaderCircle
                  size={20}
                  className="spinner"
                  aria-hidden="true"
                />
                {t.loadingLibrary}
              </div>
            ) : total === 0 && !query ? (
              <EmptyLibrary />
            ) : section === "songs" || group ? (
              <>
                {group?.kind === "artists" && artistView === "albums" ? (
                  artistAlbumsLoading && !artistAlbums.length ? (
                    <p role="status">{t.loadingAlbums}</p>
                  ) : (
                    <div className="album-grid" aria-busy={artistAlbumsLoading}>
                      {artistAlbums.map((album) => (
                        <button
                          className="album-card"
                          key={JSON.stringify([album.title, album.subtitle])}
                          onClick={(e) =>
                            openGroup("albums", album, e.currentTarget)
                          }
                        >
                          <Cover track={album.track} large />
                          <strong>{album.title}</strong>
                          <span>{album.track.releaseYear ?? ""}</span>
                        </button>
                      ))}
                    </div>
                  )
                ) : visible.length ? (
                  <TrackRows
                    ts={visible}
                    queueIds={group?.ids ?? visible.map((x) => x.id)}
                  />
                ) : group && groupLoading ? (
                  <div className="empty-small" role="status">
                    {t.loading}
                  </div>
                ) : (
                  <div className="empty-small">
                    <Search />
                    <h3>{t.noResults}</h3>
                    <p>{t.trySearch}</p>
                  </div>
                )}
              </>
            ) : (
              <div
                className="album-grid"
                aria-busy={selectedGroupPage.status === "loading"}
              >
                {catalogGroups.length ? (
                  catalogGroups.map((g) => (
                    <button
                      key={JSON.stringify([g.title, g.subtitle])}
                      className="album-card"
                      onClick={(e) =>
                        openGroup(
                          section as "albums" | "artists",
                          g,
                          e.currentTarget,
                        )
                      }
                    >
                      <Cover track={g.track} large />
                      <strong>{g.title}</strong>
                      <span>
                        {g.subtitle || formatMusicCount(g.ids.length)}
                        {section === "albums" && g.track.releaseYear
                          ? " · " + g.track.releaseYear
                          : ""}
                      </span>
                    </button>
                  ))
                ) : selectedGroupPage.status === "idle" ||
                  selectedGroupPage.status === "loading" ? (
                  <>
                    <span className="catalog-loading-label" role="status">
                      {section === "albums"
                        ? t.loadingAlbums
                        : t.loadingArtists}
                    </span>
                    {Array.from({ length: 8 }, (_, index) => (
                      <div
                        className="album-placeholder"
                        aria-hidden="true"
                        key={index}
                      >
                        <div />
                        <span />
                        <span />
                      </div>
                    ))}
                  </>
                ) : selectedGroupPage.status === "error" ? (
                  <button
                    className="button secondary"
                    onClick={() =>
                      void act(() =>
                        refreshGroups(section as "albums" | "artists"),
                      )
                    }
                  >
                    {t.retry}
                  </button>
                ) : (
                  <p className="empty-small">
                    {section === "albums" ? t.emptyAlbums : t.emptyArtists}
                  </p>
                )}
              </div>
            )}
            {(group
              ? groupTracks.length < group.ids.length
              : section === "songs"
                ? tracks.length < total
                : catalogGroups.length < groupsTotal) && (
              <button
                className="button secondary load-more"
                onClick={() =>
                  void act(async () => {
                    if (group) {
                      const version = groupRequest.current;
                      const offset = groupTracks.length;
                      const ts = await api.tracksById(
                        group.ids.slice(offset, offset + 60),
                      );
                      if (version !== groupRequest.current) return;
                      setGroupTracks((old) =>
                        old.length === offset ? [...old, ...ts] : old,
                      );
                      remember(ts);
                    } else if (section === "songs") {
                      await refresh(query, tracks.length);
                    } else {
                      await refreshGroups(
                        section as "albums" | "artists",
                        catalogGroups.length,
                      );
                    }
                  })
                }
              >
                {t.loadMore}
              </button>
            )}
          </>
        )}
      </div>
    </section>
  );
}
