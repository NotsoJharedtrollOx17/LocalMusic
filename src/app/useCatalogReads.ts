import { useEffect, useRef, useCallback } from "react";

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
  const libraryRequest = useRef(0);
  const groupRequest = useRef(0);
  const groupsRequest = useRef({ albums: 0, artists: 0 });
  const refresh = useCallback(
    async (q = "", offset = 0) => {
      const version = offset
        ? libraryRequest.current
        : ++libraryRequest.current;
      if (!offset) setLibraryLoading(true);
      try {
        const p = await api.listTracks(q, offset, 60, libraryOptions.current);
        if (version !== libraryRequest.current) return;
        setTracks((old) => (offset ? [...old, ...p.tracks] : p.tracks));
        setTotal(p.total);
        remember(p.tracks);
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
  const refreshLists = useCallback(
    async () => setLists(await api.playlists()),
    [],
  );
  return {
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
