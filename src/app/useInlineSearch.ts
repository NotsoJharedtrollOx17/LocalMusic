import { useSearchReset } from "./useSearchReset";
import {
  startTransition,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { api } from "../api";
import { matchesSearch, normalizeSearch, searchRank } from "../search/match";
import { automaticPlaylistLabel } from "./automaticPlaylistLabels";
import type { MusicAppState } from "./useAppState";
import type { CatalogGroup, Playlist, Track } from "../types";
import type { en } from "../i18n";

type Page = {
  key: string;
  view: string;
  tracks: Track[];
  groups: CatalogGroup[];
  ids: string[];
  lists: Playlist[];
  automatic: Playlist[];
  total: number;
  allTotal: number;
};
export function useInlineSearch(
  state: MusicAppState,
  t: typeof en,
  automatic: Playlist[],
  remember: (tracks: Track[]) => void,
) {
  const {
    query,
    setQuery,
    searchOpen,
    searchInput,
    setSearchOpen,
    group,
    selectedList,
    section,
    artistView,
    catalogRevision,
    sort,
    onlyFavorites,
  } = state;
  const scope = group
    ? JSON.stringify([group.kind, group.title, group.subtitle])
    : section === "playlists" && selectedList
      ? `playlist:${selectedList.id}`
      : "library";
  const owner = useRef(scope),
    trail = useRef([scope]),
    contexts = useRef(new Map<string, { query: string; open: boolean }>());
  const previous = useRef({ query, open: searchOpen });
  useLayoutEffect(() => {
    if (owner.current !== scope) {
      contexts.current.set(owner.current, previous.current);
      const index = trail.current.indexOf(scope);
      const restored = index >= 0 ? contexts.current.get(scope) : undefined;
      if (index >= 0) {
        for (const child of trail.current.splice(index + 1))
          contexts.current.delete(child);
      } else trail.current.push(scope);
      owner.current = scope;
      const next = restored ?? { query: "", open: false };
      previous.current = next;
      setQuery(next.query);
      setSearchOpen(next.open);
    } else previous.current = { query, open: searchOpen };
  }, [scope, query, searchOpen, setQuery, setSearchOpen]);
  const active = section !== "year" && Boolean(query.trim());
  const members =
    group?.ids ??
    (section === "playlists" ? selectedList?.trackIds : undefined);
  const view =
    group?.kind === "artists" && artistView === "albums"
      ? "albums"
      : members || section === "songs"
        ? "tracks"
        : section;
  const key = JSON.stringify([
    scope,
    section,
    artistView,
    normalizeSearch(query),
    onlyFavorites,
    sort,
    catalogRevision,
    members,
    state.lists,
    section === "playlists" ? automatic : null,
    state.settings?.language,
  ]);
  const reset = useSearchReset(
    JSON.stringify([key, query]),
    `${scope}:${section}:${artistView}`,
  );
  const sequence = useRef(0);
  const desired = useRef(key);
  desired.current = key;
  const pages = useRef(new Map<string, Page>());
  const artistSearches = useRef(new Map<string, Promise<CatalogGroup[]>>());
  const [page, setPage] = useState<Page>();
  const [request, setRequest] = useState({
    key: "",
    loading: false,
    error: "",
  });
  const [retry, setRetry] = useState(0),
    [apply, setApply] = useState(0);
  const immediate = useRef(false),
    lastScope = useRef("");
  const load = useCallback(
    async (offset = 0) => {
      const requestId = ++sequence.current;
      const q = query,
        requestKey = key;
      setRequest({ key: requestKey, loading: true, error: "" });
      try {
        let result: Page = {
          key: requestKey,
          view,
          tracks: [],
          groups: [],
          ids: [],
          lists: [],
          automatic: [],
          total: 0,
          allTotal: 0,
        };
        if (
          members &&
          !(group?.kind === "artists" && artistView === "albums")
        ) {
          const ids = offset
            ? pages.current.get(requestKey)!.ids
            : await api.filterTrackIds(members, q);
          const tracks = await api.tracksById(ids.slice(offset, offset + 60));
          result = {
            ...result,
            ids,
            tracks: offset
              ? [...pages.current.get(requestKey)!.tracks, ...tracks]
              : tracks,
            total: ids.length,
            allTotal: members.length,
          };
        } else if (group?.kind === "artists" && artistView === "albums") {
          const readArtistAlbums = (text: string) => {
            const cacheKey = JSON.stringify([
              group.title,
              catalogRevision,
              normalizeSearch(text),
            ]);
            const cached = artistSearches.current.get(cacheKey);
            if (cached) return cached;
            const task = (async () => {
              const found: CatalogGroup[] = [];
              for (let start = 0; ;) {
                const page = await api.groups(
                  "albums",
                  start,
                  `${group.title} ${text}`,
                );
                found.push(
                  ...page.groups.filter(
                    (album) => album.subtitle === group.title,
                  ),
                );
                start += page.groups.length;
                if (!page.groups.length || start >= page.total) break;
              }
              return found.sort(
                (a, b) => searchRank(a.title, text) - searchRank(b.title, text),
              );
            })();
            artistSearches.current.set(cacheKey, task);
            if (artistSearches.current.size > 24)
              artistSearches.current.delete(
                artistSearches.current.keys().next().value!,
              );
            void task.catch(() => artistSearches.current.delete(cacheKey));
            return task;
          };
          const [groups, all] = await Promise.all([
            readArtistAlbums(q),
            readArtistAlbums(""),
          ]);
          result = {
            ...result,
            groups: groups.slice(0, offset + 60),
            total: groups.length,
            allTotal: all.length,
          };
        } else if (section === "songs") {
          const options = { favoriteOnly: onlyFavorites, sort };
          const [found, all] = await Promise.all([
            api.listTracks(q, offset, 60, options),
            api.listTracks("", 0, 1, options),
          ]);
          result = {
            ...result,
            tracks: offset
              ? [...pages.current.get(requestKey)!.tracks, ...found.tracks]
              : found.tracks,
            total: found.total,
            allTotal: all.total,
          };
        } else if (section === "albums" || section === "artists") {
          const [found, all] = await Promise.all([
            api.groups(section, offset, q),
            api.groups(section),
          ]);
          result = {
            ...result,
            groups: offset
              ? [...pages.current.get(requestKey)!.groups, ...found.groups]
              : found.groups,
            total: found.total,
            allTotal: all.total,
          };
        } else if (section === "playlists") {
          const lists = state.lists
            .filter((p) => matchesSearch(p.title, q))
            .sort((a, b) => searchRank(a.title, q) - searchRank(b.title, q));
          const defaults = automatic
            .filter((p) => matchesSearch(automaticPlaylistLabel(p, t), q))
            .sort(
              (a, b) =>
                searchRank(automaticPlaylistLabel(a, t), q) -
                searchRank(automaticPlaylistLabel(b, t), q),
            );
          result = {
            ...result,
            lists,
            automatic: defaults,
            total: lists.length + defaults.length,
            allTotal: state.lists.length + automatic.length,
          };
        }
        if (desired.current !== requestKey || sequence.current !== requestId)
          return;
        remember([...result.tracks, ...result.groups.map((g) => g.track)]);
        pages.current.set(requestKey, result);
        if (pages.current.size > 24)
          pages.current.delete(pages.current.keys().next().value!);
        startTransition(() => {
          setPage(result);
          setRequest({ key: requestKey, loading: false, error: "" });
        });
      } catch (error) {
        if (desired.current === requestKey && sequence.current === requestId)
          setRequest({ key: requestKey, loading: false, error: String(error) });
      }
    },
    [key, remember],
  );
  useEffect(() => {
    if (!active) {
      lastScope.current = `${scope}:${section}:${artistView}`;
      return;
    }
    const cached = pages.current.get(key);
    if (cached && !immediate.current) {
      setPage(cached);
      setRequest({ key, loading: false, error: "" });
      return;
    }
    const scopeKey = `${scope}:${section}:${artistView}`;
    const delay = immediate.current || lastScope.current !== scopeKey ? 0 : 160;
    immediate.current = false;
    lastScope.current = scopeKey;
    const timer = setTimeout(() => void load(), delay);
    return () => clearTimeout(timer);
  }, [key, active, retry, apply, load]);
  const cached = pages.current.get(key);
  const current = cached ?? page;
  const pending =
    active &&
    (current?.key !== key || (request.key === key && request.loading));
  const stale = active && current?.key !== key;
  const error = active && request.key === key ? request.error : "";
  const hasMore =
    active &&
    current?.key === key &&
    view !== "playlists" &&
    (view === "tracks" ? current.tracks.length : current.groups.length) <
      current.total;
  const applyNow = () => {
    immediate.current = true;
    setApply((x) => x + 1);
  };
  const retryNow = () => {
    pages.current.delete(key);
    immediate.current = true;
    setRetry((x) => x + 1);
  };
  return {
    active,
    scope,
    page: current?.view === view ? current : undefined,
    pending: pending && !error,
    stale,
    error,
    hasMore,
    applyNow,
    retry: retryNow,
    loadMore: () =>
      !pending &&
      load(view === "tracks" ? current?.tracks.length : current?.groups.length),
    resetPhase: reset.phase,
    clear: () => {
      const restoreFocus = document.activeElement?.closest(
        "[data-search-clear],.search-empty button",
      );
      reset.run(() => {
        setQuery("");
        if (restoreFocus)
          requestAnimationFrame(() => {
            const target = searchOpen
              ? searchInput.current
              : (document.querySelector<HTMLElement>(
                  "[data-library-filters]",
                ) ??
                document.querySelector<HTMLElement>(
                  "[data-search-trigger] button",
                ));
            target?.focus({ preventScroll: true });
          });
      }, active);
    },
    close: () => {
      setQuery("");
      setSearchOpen(false);
      requestAnimationFrame(() =>
        document
          .querySelector<HTMLButtonElement>("[data-search-trigger] button")
          ?.focus(),
      );
    },
  };
}
