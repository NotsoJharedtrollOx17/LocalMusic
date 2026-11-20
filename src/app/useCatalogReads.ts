import { useEffect, useMemo, useRef, useCallback, useState } from "react";
import { api } from "../api";
import type { Track, CatalogIndex } from "../types";
import type { useAppState } from "./useAppState";

/** One complete metadata preparation; scrolling never performs catalog IO. */
export function useCatalogReads(
  state: ReturnType<typeof useAppState>,
  act: (fn: () => Promise<unknown>) => Promise<unknown>,
  remember: (tracks: Track[]) => void,
) {
  const {
    setTracks,
    setTotal,
    onlyFavorites,
    sort,
    group,
    setGroup,
    setGroupTracks,
    setGroupLoading,
    setGroupPages,
    setLibraryLoading,
    setLists,
    modal,
    setPickerTracks,
    setPickerTotal,
    pickerQuery,
    catalogRevision,
    artistView,
    setArtistAlbums,
    setArtistAlbumsLoading,
  } = state;
  const [index, setIndex] = useState<CatalogIndex | null>(null);
  const current = useRef<CatalogIndex | null>(null);
  const tracksById = useMemo(() => new Map(index?.tracks.map((t) => [t.id, t])), [index]);
  const flight = useRef<Promise<CatalogIndex> | null>(null);
  const libraryOptions = useRef({ favoriteOnly: onlyFavorites, sort });
  libraryOptions.current = { favoriteOnly: onlyFavorites, sort };
  const [playlistsReady, setPlaylistsReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const failedRead = useRef(failed);
  failedRead.current = failed;
  const libraryRequest = useRef(0),
    groupRequest = useRef(0),
    groupsRequest = useRef({ albums: 0, artists: 0 });
  const expectedRevision = useRef(catalogRevision);
  if (expectedRevision.current !== catalogRevision) {
    expectedRevision.current = catalogRevision;
    ++libraryRequest.current;
    flight.current = null;
  }
  const publish = useCallback(
    (next: CatalogIndex) => {
      current.current = next;
      setIndex(next);
      const tracks = next.tracks;
      setTracks(tracks);
      setTotal(tracks.length);
      setGroupPages({
        albums: {
          groups: next.albums,
          total: next.albums.length,
          status: "ready",
          loaded: true,
        },
        artists: {
          groups: next.artists,
          total: next.artists.length,
          status: "ready",
          loaded: true,
        },
      });
      remember(next.tracks);
      setFailed(false);
    },
    [remember],
  );
  const readIndex = useCallback(() => {
    if (!flight.current) {
      const request = api.catalogIndex();
      flight.current = request;
      void request
        .finally(() => {
          if (flight.current === request) flight.current = null;
        })
        .catch(() => {});
    }
    return flight.current;
  }, []);
  const refresh = useCallback(
    async (_q = "", _offset = 0) => {
      const version = ++libraryRequest.current;
      const revision = expectedRevision.current;
      setLibraryLoading(true);
      try {
        const next = await readIndex();
        if (
          version !== libraryRequest.current ||
          revision !== expectedRevision.current
        )
          return;
        if (current.current && next.revision < current.current.revision) return;
        publish(next);
      } catch (error) {
        if (version === libraryRequest.current) {
          setFailed(true);
          setGroupPages((old) => ({
            albums: { ...old.albums, status: "error" },
            artists: { ...old.artists, status: "error" },
          }));
        }
        throw error;
      } finally {
        if (version === libraryRequest.current) setLibraryLoading(false);
      }
    },
    [readIndex, publish],
  );
  const previousRevision = useRef(catalogRevision);
  useEffect(() => {
    if (previousRevision.current === catalogRevision) return;
    previousRevision.current = catalogRevision;
    const timer = setTimeout(
      () => void refresh().catch((error) => state.setError(String(error))),
      0,
    );
    return () => clearTimeout(timer);
  }, [catalogRevision, act, refresh]);
  const refreshGroups = useCallback(
    async (kind: "albums" | "artists", _offset = 0) => {
      const revision = expectedRevision.current;
      if (failedRead.current) {
        await refresh();
        return;
      }
      const next = current.current ?? (await readIndex());
      if (revision !== expectedRevision.current) return;
      if (!current.current) publish(next);
      else
        setGroupPages((old) => ({
          ...old,
          [kind]: {
            groups: next[kind],
            total: next[kind].length,
            status: "ready",
            loaded: true,
          },
        }));
    },
    [readIndex, publish, refresh],
  );
  const refreshGroup = useCallback(
    async (
      selected: NonNullable<typeof group>,
      _limit = 60,
      reconcile = true,
    ) => {
      const version = ++groupRequest.current;
      setGroupLoading(true);
      try {
        const next = current.current ?? (await readIndex());
        const found =
          next[selected.kind].find((g) => g.id === selected.id) ??
          next[selected.kind].find((g) =>
            g.ids.includes(selected.coverTrack.id),
          );
        const ids = found?.ids ?? (reconcile ? [] : selected.ids);
        const byId = next === index ? tracksById : new Map(next.tracks.map((t) => [t.id, t]));
        const tracks = ids
          .map((id) => byId.get(id))
          .filter((t): t is Track => !!t);
        if (version !== groupRequest.current) return;
        setGroup(
          found
            ? { ...selected, ...found, coverTrack: found.track }
            : { ...selected, ids },
        );
        setGroupTracks(tracks);
      } finally {
        if (version === groupRequest.current) setGroupLoading(false);
      }
    },
    [readIndex, index, tracksById],
  );
  useEffect(() => {
    if (index && group)
      void refreshGroup(group).catch((error) => state.setError(String(error)));
  }, [index, refreshGroup]);
  useEffect(() => {
    if (group?.kind !== "artists" || artistView !== "albums" || !index) return;
    const ids = new Set(group.ids);
    setArtistAlbums(
      index.albums.filter((g) => g.ids.some((id) => ids.has(id))),
    );
    setArtistAlbumsLoading(false);
  }, [group?.kind, group?.ids, artistView, index]);
  const refreshPicker = useCallback(
    async (q = "", offset = 0) => {
      const page = await api.listTracks(q, offset, 60);
      setPickerTracks((old) =>
        offset ? [...old, ...page.tracks] : page.tracks,
      );
      setPickerTotal(page.total);
      remember(page.tracks);
    },
    [remember],
  );
  useEffect(() => {
    if (modal !== "manual") return;
    const timer = setTimeout(
      () => void act(() => refreshPicker(pickerQuery)),
      180,
    );
    return () => clearTimeout(timer);
  }, [modal, pickerQuery, catalogRevision, act, refreshPicker]);
  const refreshLists = useCallback(async () => {
    setLists(await api.playlists());
    setPlaylistsReady(true);
  }, []);
  return {
    catalogIndex: index,
    catalogTotal: index?.tracks.length ?? null,
    playlistsReady,
    libraryViewPending: !index && !failed,
    libraryLoading: state.libraryLoading,
    libraryError: failed,
    libraryOptions,
    libraryRequest,
    groupRequest,
    groupsRequest,
    refresh,
    refreshGroup,
    refreshGroups,
    refreshPicker,
    refreshLists,
  };
}
