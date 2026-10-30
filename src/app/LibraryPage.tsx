import InlineSearch from "./InlineSearch";
import InlineSearchStatus from "./InlineSearchStatus";
import SearchTriggerIcon from "./SearchTriggerIcon";
import SearchEmpty from "./SearchEmpty";
import { Search, ArrowLeft } from "lucide-react";
import LoadingIndicator from "../components/LoadingIndicator";
import LibraryActions from "./LibraryActions";
import { api } from "../api";
import { Cover, IconButton } from "../components";
import { useMusicAppContext } from "./MusicAppContext";
import TrackRows from "./TrackRows";
import PlaylistsPage from "./PlaylistsPage";
import LibraryToolbar from "./LibraryToolbar";
import EmptyLibrary from "./EmptyLibrary";
import EmptyFavorites from "./EmptyFavorites";
import SelectionToolbar from "./SelectionToolbar";
import LibraryTabs from "./LibraryTabs";
import YourRecapPage from "./YourRecapPage";

export default function LibraryPage() {
  const {
    section,
    tracks,
    total,
    catalogTotal,
    onlyFavorites,
    libraryViewPending,
    libraryError,
    query,
    searchOpen,
    inlineSearch,
    searchInput,
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
      <div
        className={
          "page-heading library-navigation" +
          (searchOpen && section !== "year" ? " has-inline-search" : "")
        }
      >
        {group ? (
          <button className="text-button group-back" onClick={backGroup}>
            <ArrowLeft size={17} />
            {t.library}
          </button>
        ) : (
          <LibraryTabs />
        )}
        <InlineSearch />
        <div className="heading-actions">
          {section !== "year" && (
            <span data-search-trigger>
              <IconButton
                label={t.search}
                active={inlineSearch.active}
                onClick={() =>
                  searchOpen
                    ? inlineSearch.close()
                    : (setSearchOpen(true),
                      requestAnimationFrame(() => searchInput.current?.focus()))
                }
              >
                <SearchTriggerIcon />
              </IconButton>
            </span>
          )}
          <LibraryActions />
        </div>
      </div>
      <InlineSearchStatus />
      <div
        id="library-content"
        role={!group ? "tabpanel" : undefined}
        aria-labelledby={!group ? "tab-" + section : undefined}
        aria-busy={inlineSearch.active ? inlineSearch.pending : undefined}
        inert={
          inlineSearch.active &&
          (inlineSearch.stale || Boolean(inlineSearch.error))
        }
      >
        {group && (
          <div className="collection-hero">
            <Cover imageRef={detailHero} track={group.coverTrack} large />
            <div>
              <h1 tabIndex={-1}>{group.title}</h1>
              {group.subtitle && <span>{group.subtitle}</span>}
              <span>
                {[
                  group.kind === "albums" ? group.coverTrack.releaseYear : null,
                  formatMusicCount(group.ids.length),
                ]
                  .filter(Boolean)
                  .join(" · ")}
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
          <YourRecapPage />
        ) : section === "playlists" ? (
          <PlaylistsPage />
        ) : (
          <>
            <LibraryToolbar />

            {inlineSearch.active &&
            !inlineSearch.pending &&
            !inlineSearch.error &&
            inlineSearch.page?.total === 0 ? (
              <SearchEmpty />
            ) : !inlineSearch.active &&
              !group &&
              section === "songs" &&
              libraryError ? (
              <div className="empty-small">
                <button
                  className="button secondary"
                  onClick={() => void act(() => refresh(query))}
                >
                  {t.retry}
                </button>
              </div>
            ) : !inlineSearch.active &&
              !group &&
              section === "songs" &&
              (libraryViewPending || (libraryLoading && !tracks.length)) ? (
              <div className="catalog-loading">
                <LoadingIndicator label={t.loadingLibrary} />
              </div>
            ) : catalogTotal === 0 &&
              !group &&
              !(section === "songs" && onlyFavorites) ? (
              <EmptyLibrary />
            ) : section === "songs" || group ? (
              <>
                {group?.kind === "artists" && artistView === "albums" ? (
                  artistAlbumsLoading && !artistAlbums.length ? (
                    <LoadingIndicator label={t.loadingAlbums} />
                  ) : (
                    <div className="album-grid" aria-busy={artistAlbumsLoading}>
                      {artistAlbums.map((album) => (
                        <button
                          className="album-card"
                          data-group-key={JSON.stringify([
                            "albums",
                            album.title,
                            album.subtitle,
                          ])}
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
                  <LoadingIndicator label={t.loading} />
                ) : !group && onlyFavorites && !query ? (
                  <EmptyFavorites />
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
                      data-group-key={JSON.stringify([
                        section,
                        g.title,
                        g.subtitle,
                      ])}
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
                    <span
                      className="catalog-loading-label"
                      role="status"
                      aria-label={
                        section === "albums"
                          ? t.loadingAlbums
                          : t.loadingArtists
                      }
                    />
                    {Array.from({ length: 8 }, (_, index) => (
                      <div
                        className="album-placeholder"
                        aria-hidden="true"
                        key={index}
                      >
                        <div>
                          <LoadingIndicator label={t.loading} />
                        </div>
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
            {!inlineSearch.active &&
              (group
                ? groupLoading && visible.length > 0
                : section === "songs"
                  ? libraryLoading && !libraryViewPending && tracks.length > 0
                  : selectedGroupPage.status === "loading" &&
                    catalogGroups.length > 0) && (
                <LoadingIndicator label={t.loading} />
              )}
            {!inlineSearch.active &&
              (group
                ? groupTracks.length < group.ids.length
                : section === "songs"
                  ? !libraryLoading && !libraryError && tracks.length < total
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
        {inlineSearch.hasMore && (
          <button
            className="button secondary load-more"
            disabled={inlineSearch.pending}
            onClick={() => void inlineSearch.loadMore()}
          >
            {t.loadMore}
          </button>
        )}
      </div>
    </section>
  );
}
