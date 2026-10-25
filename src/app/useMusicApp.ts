import { useRecapPeriods } from "./useRecapPeriods";
import { useAutomaticPlaylists } from "./useAutomaticPlaylists";
import { dismissMenu, hasOpenMenu } from "../ux/menuLayer";
import { audioShareLabel } from "../ux/sharing";
import { useSoundController } from "../sound/useSoundController";
import { useMusicActions } from "./useMusicActions";
import { useAppState } from "./useAppState";
import { useCatalogReads } from "./useCatalogReads";
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import { useLibraryMotion, animateCover, type LibrarySection } from "../ux";
import { useBackLayer } from "../navigation";
import { api } from "../api";
import { en, es } from "../i18n";
import { compareCatalogTracks } from "../domain";
import { applyTheme } from "../theme";
import { type Track, type Settings, type CatalogGroup } from "../types";

export function useMusicApp(initialSettings?: Settings) {
  const state = useAppState(initialSettings);
  const {
    section,
    setSection,
    tracks,
    cache,
    setCache,
    query,
    searchOpen,
    setSearchOpen,
    onlyFavorites,
    setOnlyFavorites,
    sort,
    group,
    setGroup,
    groupTracks,
    setGroupTracks,
    setGroupLoading,
    groupPages,
    setGroupPages,
    queueLimit,
    settings,
    setSettings,
    player,
    setPlayer,
    selectedList,
    setSelectedList,
    generated,
    recap,
    setRecap,
    shareRecap,
    setRecapLoading,
    setRecapError,
    recapRevision,
    setRecapRevision,
    snapshotMode,
    setSnapshots,
    recapSelection,
    setRecapSelection,
    notice,
    setNotice,
    setError,
    modal,
    setModal: setModalState,
    setEditingList,
    catalogRevision,
    setCatalogRevision,
    setSelectedIds,
    selectionMode,
    setSelectionMode,
    menu,
    artistView,
    setArtistView,
    coverOrigin,
    detailHero,
    groupScroll,
    lastSelected,
    groupStack,
    latestQuery,
    settingsWrite,
    searchInput,
  } = state;
  const soundController = useSoundController(modal === "equalizer");
  type Dialog = typeof modal;
  const dialogHistory = useRef<Array<NonNullable<Dialog>>>([]);
  const dialogScroll = useRef(new Map<NonNullable<Dialog>, number>());
  useLayoutEffect(() => {
    if (!modal) return;
    const position = dialogScroll.current.get(modal);
    const body = document.querySelector<HTMLElement>(".modal-body");
    if (position !== undefined && body) body.scrollTop = position;
  }, [modal]);
  function dismissModals() {
    dialogHistory.current = [];
    state.setPlayerParent(null);
    setModalState(null);
  }
  function setModal(action: React.SetStateAction<Dialog>) {
    const next = typeof action === "function" ? action(modal) : action;
    if (next === modal) return;
    const body = document.querySelector<HTMLElement>(".modal-body");
    if (modal && body) dialogScroll.current.set(modal, body.scrollTop);
    if (next === "player" || next === "queue") {
      dialogHistory.current = [];
      state.setPlayerParent(null);
      setModalState(next);
      return;
    }
    if (next === null) {
      if (modal === "player" || modal === "queue") {
        dismissModals();
        return;
      }
      const parent = dialogHistory.current.pop() ?? state.playerParent;
      if (parent === "player" || parent === "queue")
        state.setPlayerParent(null);
      setModalState(parent ?? null);
      return;
    }
    if (dialogHistory.current.at(-1) === next) dialogHistory.current.pop();
    else if (modal === "player" || modal === "queue")
      state.setPlayerParent(modal);
    else {
      dialogScroll.current.delete(next);
      if (modal) dialogHistory.current.push(modal);
    }
    setModalState(next);
  }

  const selectedGroupPage =
    groupPages[section === "artists" ? "artists" : "albums"];
  const catalogGroups = selectedGroupPage.groups,
    groupsTotal = selectedGroupPage.total;

  const motion = useLibraryMotion(section, (next: LibrarySection) => {
    closeGroup();
    setSection(next);
    setOnlyFavorites(false);
    setSelectionMode(false);
    setSelectedIds([]);
  });

  latestQuery.current = query;

  const t = settings?.language === "es" ? es : en;
  useEffect(() => {
    const sync = () => {
      if (document.hidden) return;
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      setSettings((current) =>
        current && current.timeZone !== timeZone
          ? { ...current, timeZone }
          : current,
      );
    };
    sync();
    window.addEventListener("focus", sync);
    document.addEventListener("visibilitychange", sync);
    const timer = window.setInterval(sync, 60000);
    return () => {
      window.removeEventListener("focus", sync);
      document.removeEventListener("visibilitychange", sync);
      window.clearInterval(timer);
    };
  }, [setSettings, Boolean(settings)]);
  const act = useCallback(async (fn: () => Promise<unknown>) => {
    setError("");
    try {
      return await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);
  const recapPeriods = useRecapPeriods(
    settings,
    setSettings,
    recapSelection,
    setRecapSelection,
    snapshotMode,
    state.setSnapshotMode,
  );
  const remember = useCallback(
    (ts: Track[]) =>
      setCache((c) => ({
        ...c,
        ...Object.fromEntries(ts.map((x) => [x.id, x])),
      })),
    [],
  );
  const automatic = useAutomaticPlaylists(
    section === "playlists",
    catalogRevision,
    `${player.trackId}|${player.playing}|${player.excluded}`,
    remember,
    setSelectedList,
  );
  useEffect(() => {
    if (section !== "playlists" || selectedList?.kind !== "automatic") return;
    const visible = new Set(selectedList.trackIds);
    setSelectedIds((current) =>
      current.some((id) => !visible.has(id))
        ? current.filter((id) => visible.has(id))
        : current,
    );
  }, [section, selectedList, setSelectedIds]);
  const catalog = useCatalogReads(state, act, remember);
  const lastPlaybackError = useRef<string | null>(null);
  const { groupRequest, refresh, refreshGroup, refreshGroups, refreshLists } =
    catalog;
  useEffect(() => {
    void act(async () => {
      setSettings(initialSettings ?? (await api.settings()));
      await refresh();
      await refreshLists();
    });
    let unsubscribe: (() => void) | undefined;
    let disposed = false;
    void api
      .subscribe((s) => {
        setPlayer(s);
        if (s.error && s.error !== lastPlaybackError.current) setError(s.error);
        lastPlaybackError.current = s.error || null;
      })
      .then((u) => {
        if (disposed) u();
        else unsubscribe = u;
      })
      .catch((e) => setError(String(e)));
    return () => {
      disposed = true;
      unsubscribe?.();
    };
  }, [act, refresh, refreshLists]);
  useEffect(() => {
    const id = setTimeout(() => void act(() => refresh(query)), 180);
    return () => clearTimeout(id);
  }, [query, onlyFavorites, sort, refresh, act]);
  useEffect(() => {
    if (section === "albums" || section === "artists")
      void act(() => refreshGroups(section));
  }, [section, catalog.catalogTotal, catalogRevision, act, refreshGroups]);
  const groupIdentity = group
    ? JSON.stringify([group.kind, group.title, group.subtitle])
    : "";
  useLayoutEffect(() => {
    dismissMenu();
    state.setMenu(null);
  }, [
    section,
    groupIdentity,
    artistView,
    selectedList?.id,
    modal,
    searchOpen,
    shareRecap,
  ]);
  useEffect(() => {
    setSelectionMode(false);
    setSelectedIds([]);
  }, [section, groupIdentity, artistView, selectedList?.id]);
  const restoreGroupScroll = useRef<number | null>(null);
  const groupOrigin = useRef<{ section: LibrarySection; selector?: string }>({
    section,
  });
  const restoreGroupFocus = useRef(false);
  useLayoutEffect(() => {
    if (restoreGroupScroll.current !== null) {
      window.scrollTo({ top: restoreGroupScroll.current, behavior: "instant" });
      restoreGroupScroll.current = null;
    }
    if (!group && restoreGroupFocus.current) {
      restoreGroupFocus.current = false;
      const selector = groupOrigin.current.selector;
      const frame = requestAnimationFrame(() => {
        (
          document.querySelector<HTMLElement>(
            selector ?? '.section-tabs [aria-selected="true"]',
          ) ??
          document.querySelector<HTMLElement>(
            '.section-tabs [aria-selected="true"]',
          )
        )?.focus({ preventScroll: true });
      });
      return () => cancelAnimationFrame(frame);
    }
  }, [groupIdentity]);
  useEffect(() => {
    if (group)
      void act(() => refreshGroup(group, Math.max(60, groupTracks.length)));
  }, [catalogRevision, groupIdentity, refreshGroup, act]);
  function closeGroup(restore?: number) {
    restoreGroupScroll.current = restore ?? null;
    groupStack.current = [];
    ++groupRequest.current;
    setGroup(null);
    setGroupTracks([]);
    setGroupLoading(false);
  }
  useEffect(() => {
    if (searchOpen) searchInput.current?.focus();
  }, [searchOpen]);
  useEffect(() => {
    if (settings) {
      document.documentElement.lang = settings.language;
      applyTheme(settings.theme);
      settingsWrite.current = settingsWrite.current
        .catch(() => {})
        .then(() => api.saveSettings(settings));
      void act(() => settingsWrite.current);
    }
  }, [settings]);
  useEffect(() => {
    const ids = [
      ...new Set([
        ...(player.trackId ? [player.trackId] : []),
        ...(modal === "queue" ? player.queue.slice(0, queueLimit) : []),
        ...(section === "year" && recap
          ? recap.topTracks.map((item) => item.track.id)
          : []),
      ]),
    ].filter((id) => !cache[id]);
    if (ids.length) void act(async () => remember(await api.tracksById(ids)));
  }, [
    player.queue,
    player.trackId,
    cache,
    modal,
    queueLimit,
    section,
    recap,
    act,
    remember,
  ]);
  const recapRequest = useRef(0);
  useEffect(() => {
    if (section !== "year" || !settings || snapshotMode) return;
    const version = ++recapRequest.current;
    let active = true;
    setRecapLoading(true);
    setRecapError("");
    void act(async () => {
      try {
        await settingsWrite.current;
        const result = await api.recap(recapSelection);
        const saved = await api.snapshots();
        if (!active || version !== recapRequest.current) return;
        setRecap(result);
        setSnapshots(saved);
      } catch (error) {
        if (active && version === recapRequest.current)
          setRecapError(error instanceof Error ? error.message : String(error));
      } finally {
        if (active && version === recapRequest.current) setRecapLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, [
    section,
    recapSelection,
    settings,
    snapshotMode,
    recapRevision,
    player.playing,
    act,
  ]);
  useEffect(() => {
    if (section !== "year" || snapshotMode || shareRecap) return;
    const refresh = () => setRecapRevision((v) => v + 1);
    window.addEventListener("focus", refresh);
    const timer = player.playing
      ? window.setInterval(refresh, 15000)
      : undefined;
    return () => {
      window.removeEventListener("focus", refresh);
      if (timer) window.clearInterval(timer);
    };
  }, [section, snapshotMode, shareRecap, player.playing]);
  useEffect(() => {
    const listener = (e: KeyboardEvent) => {
      if (
        /INPUT|SELECT|TEXTAREA|BUTTON|A/.test(
          (e.target as HTMLElement).tagName,
        ) ||
        modal ||
        menu ||
        hasOpenMenu() ||
        searchOpen ||
        selectionMode ||
        shareRecap
      )
        return;
      if (e.code === "Space" && player.trackId) {
        e.preventDefault();
        void act(() => api.toggle());
      }
      if (e.key === "/") {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, [modal, shareRecap, player.trackId, act, menu, searchOpen, selectionMode]);
  useEffect(() => {
    if (!notice) return;
    const timeout = setTimeout(() => setNotice(""), 4500);
    return () => clearTimeout(timeout);
  }, [notice]);
  const current = player.trackId ? cache[player.trackId] : undefined;
  function backGroup() {
    const previous = groupStack.current.pop();
    if (previous) {
      restoreGroupScroll.current = previous.scroll;
      setSection(previous.group.kind);
      setArtistView(previous.artistView);
      void act(async () => {
        await refreshGroup(previous.group);
      });
    } else {
      setSection(groupOrigin.current.section);
      restoreGroupFocus.current = true;
      closeGroup(groupScroll.current);
    }
  }
  useBackLayer(section === "year" && !modal && !searchOpen && !menu, () =>
    setSection("songs"),
  );
  useBackLayer(!!group && !modal && !searchOpen && !menu, backGroup);
  useBackLayer(
    section === "playlists" &&
      !!selectedList &&
      !modal &&
      !searchOpen &&
      !menu &&
      !selectionMode,
    () => {
      setSelectedList(null);
      setEditingList(false);
    },
  );
  useBackLayer(selectionMode && !modal && !menu, () => {
    setSelectionMode(false);
    setSelectedIds([]);
  });
  function toggleSelected(
    id: string,
    shift = false,
    order = visible.map((t) => t.id),
  ) {
    if (!selectionMode) lastSelected.current = undefined;
    setSelectionMode(true);
    const a = lastSelected.current ? order.indexOf(lastSelected.current) : -1,
      b = order.indexOf(id);
    setSelectedIds((old) =>
      shift && a >= 0 && b >= 0
        ? [
            ...new Set([
              ...old,
              ...order.slice(Math.min(a, b), Math.max(a, b) + 1),
            ]),
          ]
        : old.includes(id)
          ? old.filter((x) => x !== id)
          : [...old, id],
    );
    lastSelected.current = id;
  }
  async function changeVisibility(ids: string[], visible: boolean) {
    await api.setLibraryVisibility(ids, visible);
    const changed = await api.tracksById(ids);
    remember(changed);
    setGroupTracks((old) =>
      old.map((track) => changed.find((t) => t.id === track.id) ?? track),
    );
    if (!visible)
      state.setArtistAlbums((old) =>
        old
          .map((g) => ({ ...g, ids: g.ids.filter((id) => !ids.includes(id)) }))
          .filter((g) => g.ids.length),
      );
    await refresh(query);
    setCatalogRevision((v) => v + 1);
    setGroupPages({
      albums: { groups: [], total: 0, status: "idle" },
      artists: { groups: [], total: 0, status: "idle" },
    });
  }
  const sharingActive = useRef(false);
  const shareLabel = audioShareLabel(t, state.selectedIds.length);
  async function share(ids: string[]) {
    if (sharingActive.current) return;
    sharingActive.current = true;
    state.setSharing(true);
    await act(async () => {
      const result = await api.shareAudio(ids);
      if (result !== "canceled")
        setNotice(
          result === "saved"
            ? t.copiesSaved
            : result === "download"
              ? t.downloadStarted
              : t.shareOpened,
        );
    }).finally(() => {
      sharingActive.current = false;
      state.setSharing(false);
    });
  }
  function openGroup(
    kind: "albums" | "artists",
    g: CatalogGroup,
    source?: HTMLElement,
  ) {
    restoreGroupScroll.current = null;
    if (
      group?.kind === kind &&
      group.title === g.title &&
      group.subtitle === g.subtitle
    ) {
      setArtistView("tracks");
      window.scrollTo({ top: 0, behavior: "instant" });
      return;
    }
    if (!group) {
      groupScroll.current = window.scrollY;
      const row = source?.closest<HTMLElement>("[data-track-id]");
      const key = source?.dataset.groupKey;
      groupOrigin.current = {
        section,
        selector: row?.dataset.trackId
          ? `[data-track-id="${CSS.escape(row.dataset.trackId)}"] [aria-haspopup="menu"]`
          : key
            ? `[data-group-key="${CSS.escape(key)}"]`
            : undefined,
      };
    } else
      groupStack.current.push({ group, scroll: window.scrollY, artistView });
    const image = source?.querySelector<HTMLImageElement>("img");
    coverOrigin.current = image
      ? { rect: image.getBoundingClientRect(), src: image.src }
      : null;
    setSection(kind);
    const opening = refreshGroup({
      kind,
      title: g.title,
      subtitle: g.subtitle,
      ids: g.ids,
      coverTrack: g.track,
    });
    const version = groupRequest.current;
    void act(async () => {
      await opening;
      if (version === groupRequest.current) {
        setArtistView("tracks");
        window.scrollTo({ top: 0, behavior: "instant" });
      }
    });
  }
  useEffect(() => {
    const origin = coverOrigin.current,
      node = detailHero.current;
    if (!group || !origin || !node) return;
    coverOrigin.current = null;
    return animateCover(origin.rect, node.getBoundingClientRect(), origin.src);
  }, [group?.title, group?.kind]);
  useEffect(() => {
    if (group)
      document
        .querySelector<HTMLElement>(".library-page h1")
        ?.focus({ preventScroll: true });
  }, [group?.title, group?.kind]);
  async function openEqualizer() {
    setModal("equalizer");
  }
  const formatMinutes = (ms: number) =>
    ms > 0 && ms < 60000
      ? "<1"
      : Math.round(ms / 60000).toLocaleString(settings?.language);
  const formatMusicCount = (count: number, songs = false) =>
    `${count.toLocaleString(settings?.language)} ${
      count === 1
        ? settings?.language === "es"
          ? t.songSingular
          : songs
            ? t.songSingular
            : "track"
        : songs
          ? t.songCount
          : t.tracks
    }`;
  const formatDate = (s: string, zone = settings?.timeZone) =>
    new Intl.DateTimeFormat(settings?.language ?? "en", {
      month: "short",
      day: "numeric",
      year: "numeric",
      timeZone: zone,
    }).format(new Date(s));
  const visible = useMemo(
    () =>
      group
        ? groupTracks.filter((t) => !t.hidden)
        : tracks
            .filter((x) => !onlyFavorites || x.favorite)
            .sort((a, b) => compareCatalogTracks(a, b, sort)),
    [tracks, groupTracks, onlyFavorites, group, sort],
  );
  const actions = useMusicActions(state, {
    act,
    remember,
    refresh,
    refreshLists,
    t,
  });

  const playlistTracks =
    (selectedList ?? generated)?.trackIds
      .map((id) => cache[id])
      .filter((x): x is Track => !!x && !x.hidden) ?? [];
  return {
    ...state,
    soundController,
    automatic,
    setModal,
    dismissModals,
    shareLabel,
    ...catalog,
    ...actions,
    selectedGroupPage,
    catalogGroups,
    groupsTotal,
    motion,
    t,
    ...recapPeriods,
    act,
    remember,
    groupIdentity,
    closeGroup,
    recapRequest,
    current,
    backGroup,
    toggleSelected,
    changeVisibility,
    share,
    openGroup,
    openEqualizer,
    formatMinutes,
    formatMusicCount,
    formatDate,
    visible,
    playlistTracks,
  };
}
