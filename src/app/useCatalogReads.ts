import { useEffect, useRef, useCallback, useState } from "react";

import { api } from "../api";

import { type Track, type CatalogGroup } from "../types";

import type { useAppState } from "./useAppState";
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
  const libraryOptions = useRef({ favoriteOnly: onlyFavorites, sort });
  libraryOptions.current = { favoriteOnly: onlyFavorites, sort };
  const [catalogTotal, setCatalogTotal] = useState<number | null>(null);
  const [playlistsReady, setPlaylistsReady] = useState(false);
  const [libraryRead, setLibraryRead] = useState<{
    key: string;
    failed: boolean;
  } | null>(null);
  const key = JSON.stringify([state.query, onlyFavorites, sort]);
  const desiredKey = useRef(key);
  desiredKey.current = key;
  const libraryRequest = useRef(0);
  const groupRequest = useRef(0);
  const groupsRequest = useRef({ albums: 0, artists: 0 });
  const refresh = useCallback(
    async (q = "", offset = 0) => {
      const options = { ...libraryOptions.current };
      const requestKey = JSON.stringify([
        q,
        options.favoriteOnly,
        options.sort,
      ]);
      if (requestKey !== desiredKey.current) return;
      const version = offset
        ? libraryRequest.current
        : ++libraryRequest.current;
      if (!offset) setLibraryLoading(true);
      try {
        // A filtered page total is never the size of the user's library.
        const [p, catalog] = await Promise.all([
          api.listTracks(q, offset, 60, options),
          q || options.favoriteOnly ? api.listTracks("", 0, 1) : null,
        ]);
        if (
          version !== libraryRequest.current ||
          requestKey !== desiredKey.current
        )
          return;
        setTracks((old) => (offset ? [...old, ...p.tracks] : p.tracks));
        setTotal(p.total);
        setCatalogTotal(catalog?.total ?? p.total);
        setLibraryRead({ key: requestKey, failed: false });
        remember(p.tracks);
      } catch (error) {
        if (
          version !== libraryRequest.current ||
          requestKey !== desiredKey.current
        )
          return;
        setLibraryRead({ key: requestKey, failed: true });
        throw error;
      } finally {
        if (version === libraryRequest.current) setLibraryLoading(false);
      }
    },
    [remember],
  );
  const refreshGroup = useCallback(
    async (selected: NonNullable<typeof group>, limit = 60) => {
      const version = ++groupRequest.current;
      setGroupLoading(true);
      try {
        const ids = await api.groupIds(
          selected.kind,
          selected.title,
          selected.subtitle,
        );
        const nextTracks = await api.tracksById(ids.slice(0, limit));
        if (version !== groupRequest.current) return;
        setGroup({ ...selected, ids });
        setGroupTracks(nextTracks);
        remember(nextTracks);
      } finally {
        if (version === groupRequest.current) setGroupLoading(false);
      }
    },
    [remember],
  );
  const artistAlbumCache = useRef(new Map<string, CatalogGroup[]>());
  const artistAlbumOwner = useRef("");
  useEffect(() => {
    if (group?.kind !== "artists" || artistView !== "albums") return;
    const cacheKey = JSON.stringify([group.title, group.ids, catalogRevision]);
    const cached = artistAlbumCache.current.get(cacheKey);
    if (cached) {
      artistAlbumOwner.current = group.title;
      setArtistAlbums(cached);
      setArtistAlbumsLoading(false);
      return;
    }
    let live = true;
    setArtistAlbumsLoading(true);
    if (artistAlbumOwner.current !== group.title) {
      setArtistAlbums([]);
      artistAlbumOwner.current = group.title;
    }
    void act(async () => {
      const artistIds = new Set(group.ids),
        albums: CatalogGroup[] = [];
      for (let offset = 0; ;) {
        const page = await api.groups("albums", offset);
        if (!live) return;
        albums.push(
          ...page.groups.filter((album) =>
            album.ids.some((id) => artistIds.has(id)),
          ),
        );
        offset += page.groups.length;
        if (offset >= page.total || !page.groups.length) break;
      }
      remember(albums.map((album) => album.track));
      artistAlbumCache.current.set(cacheKey, albums);
      if (artistAlbumCache.current.size > 16)
        artistAlbumCache.current.delete(
          artistAlbumCache.current.keys().next().value!,
        );
      setArtistAlbums(albums);
    }).finally(() => {
      if (live) setArtistAlbumsLoading(false);
    });
    return () => {
      live = false;
    };
  }, [
    group?.kind,
    group?.title,
    group?.ids.join("|"),
    artistView,
    catalogRevision,
    act,
    remember,
  ]);
  const refreshGroups = useCallback(
    async (kind: "albums" | "artists", offset = 0) => {
      const version = ++groupsRequest.current[kind];
      setGroupPages((old) => ({
        ...old,
        [kind]: { ...old[kind], status: "loading" },
      }));
      try {
        const p = await api.groups(kind, offset);
        if (version !== groupsRequest.current[kind]) return;
        setGroupPages((old) => ({
          ...old,
          [kind]: {
            groups: offset
              ? old[kind].groups.length === offset
                ? [...old[kind].groups, ...p.groups]
                : old[kind].groups
              : p.groups,
            total: p.total,
            status: "ready",
          },
        }));
        remember(p.groups.map((g) => g.track));
      } catch (error) {
        if (version === groupsRequest.current[kind])
          setGroupPages((old) => ({
            ...old,
            [kind]: { ...old[kind], status: "error" },
          }));
        throw error;
      }
    },
    [remember],
  );
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
    catalogTotal,
    playlistsReady,
    libraryViewPending: libraryRead?.key !== key,
    libraryLoading: state.libraryLoading || libraryRead?.key !== key,
    libraryError: libraryRead?.key === key && libraryRead.failed,
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
