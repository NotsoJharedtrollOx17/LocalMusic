import LibraryPageBoundary from "./LibraryPageBoundary";
import CatalogGroupGrid from "./CatalogGroupGrid";

import SearchEmpty from "./SearchEmpty";
import { Search } from "lucide-react";
import LoadingIndicator from "../components/LoadingIndicator";

import { api } from "../api";
import { Cover } from "../components";
import { useMusicAppContext } from "./MusicAppContext";
import TrackRows from "./TrackRows";
import PlaylistsPage from "./PlaylistsPage";
import LibraryToolbar from "./LibraryToolbar";
import EmptyLibrary from "./EmptyLibrary";
import EmptyFavorites from "./EmptyFavorites";
import SelectionToolbar from "./SelectionToolbar";

import YourRecapPage from "./YourRecapPage";

export default function LibraryPaneContents() {
  const {
    section,
    tracks,
    total,
    catalogTotal,
    onlyFavorites,
    sort,
    catalogRevision,
    libraryViewPending,
    libraryError,
    query,
    inlineSearch,
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
    t,
    formatMusicCount,
    act,
    remember,
    groupRequest,
    refresh,
    refreshGroups,
    openGroup,
    visible,
  } = useMusicAppContext();

  return (
    <>
      {group && (
        <div className="collection-hero" data-kind={group.kind}>
          <Cover imageRef={detailHero} track={group.coverTrack} large />
          <div>
            <h1 tabIndex={-1}>{group.title}</h1>
            {group.subtitle && <span>{group.subtitle}</span>}
            <span className="collection-hero-metadata">
              {group.kind === "albums" && group.coverTrack.releaseYear && (
                <span className="collection-release-year">
                  {group.coverTrack.releaseYear}
                </span>
              )}
              <span className="collection-hero-count">
                {group.kind === "albums" && group.coverTrack.releaseYear
                  ? " ? "
                  : ""}
                {formatMusicCount(group.ids.length)}
              </span>
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
          {!inlineSearch.active &&
            !group &&
            section === "songs" &&
            libraryError &&
            tracks.length > 0 && (
              <div className="catalog-refresh-error">
                <button
                  className="text-button"
                  onClick={() => void act(() => refresh())}
                >
                  {t.retry}
                </button>
              </div>
            )}

          {inlineSearch.active &&
          !inlineSearch.pending &&
          !inlineSearch.error &&
          inlineSearch.page?.total === 0 ? (
            <SearchEmpty />
          ) : !inlineSearch.active &&
            !group &&
            section === "songs" &&
            libraryError &&
            !tracks.length ? (
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
                  <CatalogGroupGrid
                    groups={artistAlbums}
                    kind="albums"
                    loading={artistAlbumsLoading}
                  />
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
            <CatalogGroupGrid />
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
              <LibraryPageBoundary
                progress={JSON.stringify([
                  section,
                  group?.id ?? group?.title,
                  query,
                  onlyFavorites,
                  sort,
                  catalogRevision,
                  group
                    ? groupTracks.length
                    : section === "songs"
                      ? tracks.length
                      : catalogGroups.length,
                ])}
                loading={
                  group
                    ? groupLoading
                    : section === "songs"
                      ? libraryLoading
                      : selectedGroupPage.status === "loading"
                }
                label={t.loadMore}
                retry={t.retry}
                onLoad={() =>
                  act(async () => {
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
              />
            )}
        </>
      )}
      {inlineSearch.hasMore && (
        <LibraryPageBoundary
          progress={JSON.stringify([
            inlineSearch.page?.key,
            inlineSearch.page?.tracks.length,
            inlineSearch.page?.groups.length,
          ])}
          loading={inlineSearch.pending}
          onLoad={() => inlineSearch.loadMore()}
          label={t.loadMore}
          retry={t.retry}
        />
      )}
    </>
  );
}
