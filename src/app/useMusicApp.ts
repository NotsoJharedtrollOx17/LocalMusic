import {
  libraryScrollTop,
  scrollLibraryTo,
  captureLibraryPosition,
} from "../ux/libraryScroll";
import { listen } from "@tauri-apps/api/event";
import { native } from "../api";
import { useInlineSearch } from "./useInlineSearch";
import { invoke } from "@tauri-apps/api/core";
import { useRecapPeriods } from "./useRecapPeriods";
import { useAutomaticPlaylists } from "./useAutomaticPlaylists";
import { dismissMenu, hasOpenMenu } from "../ux/menuLayer";
import { audioShareLabel } from "../ux/sharing";
import { useSoundController } from "../sound/useSoundController";
import { useMusicActions } from "./useMusicActions";
import { usePersonalizedPlaylists } from "./usePersonalizedPlaylists";
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
import { useSyncedSettings } from "../desktop/useSyncedSettings";
import { useMainWindows } from "../desktop/useMainWindows";
import { desktop, useDesktopWindows } from "../desktop/windows";
import { useDesktopMenu } from "../desktop/useDesktopMenu";
import { type Track, type Settings, type CatalogGroup } from "../types";

export function useMusicApp(initialSettings?: Settings) {
  const state = useAppState(initialSettings);
  const desktopWindows = useDesktopWindows();
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
    searchInput,
  } = state;
  const soundController = useSoundController(modal === "equalizer");
  const nativeSearchFocus = useRef(false);
  useLayoutEffect(() => {
    if (!nativeSearchFocus.current || !searchOpen || section === "year") return;
    nativeSearchFocus.current = false;
    searchInput.current?.focus();
  }, [searchOpen, section, searchInput]);
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
    if (
      (next === "player" || next === "queue" || next === "visualizer") &&
      desktop.entry(next === "visualizer" ? "visualizer" : "player")?.phase ===
        "detached"
    ) {
      void desktop
        .action({
          op: "open",
          view: next === "visualizer" ? "visualizer" : "player",
          queue: next === "queue",
        })
        .catch((e) => setError(String(e)));
      return;
    }
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
  const personalization = usePersonalizedPlaylists(state, t);
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
    !state.libraryLoading,
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
  const inlineSearch = useInlineSearch(
    state,
    t,
    automatic.playlists,
    remember,
    catalog.catalogIndex,
  );
  const lastPlaylist = useRef<string | undefined>(undefined);
  const restorePlaylist = useRef<{ scroll: number; id: string } | null>(null);
  useLayoutEffect(() => {
    const previous = lastPlaylist.current;
    lastPlaylist.current = selectedList?.id;
    if (previous && !selectedList && section === "playlists")
      restorePlaylist.current = state.playlistOrigin.current;
    const origin = restorePlaylist.current;
    if (
      !origin ||
      selectedList ||
      section !== "playlists" ||
      inlineSearch.pending ||
      inlineSearch.stale
    )
      return;
    const frame = requestAnimationFrame(() => {
      const button = document.querySelector<HTMLElement>(
        `[data-playlist-id="${CSS.escape(origin.id)}"] button,[data-playlist-id="${CSS.escape(origin.id)}"].automatic-playlist-tile`,
      );
      if (button && !button.closest("[inert]")) {
        scrollLibraryTo({ top: origin.scroll, behavior: "instant" });
        button.focus({ preventScroll: true });
        restorePlaylist.current = null;
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [selectedList?.id, section, inlineSearch.pending, inlineSearch.stale]);
  const lastPlaybackError = useRef<string | null>(null);
  const { groupRequest, refresh, refreshGroup, refreshGroups, refreshLists } =
    catalog;
  useEffect(() => {
    void act(async () => {
      setSettings(initialSettings ?? (await api.settings()));
      await Promise.all([refresh(), refreshLists()]);
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
  const organizationDetail = useRef(state.detail);
  organizationDetail.current = state.detail;
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined,
      dead = false,
      off: (() => void) | undefined;
    const changed = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (dead) return;
        setCatalogRevision((v) => v + 1);
        setRecapRevision((v) => v + 1);
        // Keep confirmed metadata usable while a new revision is prepared.
        state.setShareRecap(null);
        void act(async () => {
          await refresh();
          await refreshLists();
          if (organizationDetail.current) {
            const [detail] = await api.tracksById([
              organizationDetail.current.id,
            ]);
            state.setDetail(detail ?? null);
          }
        });
      }, 150);
    };
    window.addEventListener("library-organization-changed", changed);
    if (native)
      void listen("library://metadata", changed).then((fn) => {
        if (dead) fn();
        else off = fn;
      });
    return () => {
      dead = true;
      clearTimeout(timer);
      off?.();
      window.removeEventListener("library-organization-changed", changed);
    };
  }, [refresh, refreshLists, act]);
  const groupIdentity = group
    ? JSON.stringify([group.kind, group.id ?? [group.title, group.subtitle]])
    : "";
  useLayoutEffect(() => {
    dismissMenu();
    state.setMenu(null);
  }, [section, groupIdentity, artistView, selectedList?.id, modal, shareRecap]);
  useLayoutEffect(() => {
    if (!searchOpen) return;
    dismissMenu();
    state.setMenu(null);
  }, [searchOpen]);
  useEffect(() => {
    setSelectionMode(false);
    setSelectedIds([]);
  }, [section, groupIdentity, artistView, selectedList?.id, query]);
  const restoreGroupScroll = useRef<number | null>(null);
  const groupOrigin = useRef<{ section: LibrarySection; selector?: string }>({
    section,
  });
  const restoreGroupFocus = useRef(false);
  const restoreNestedGroupFocus = useRef<string | null>(null);
  useLayoutEffect(() => {
    if (restoreGroupScroll.current !== null) {
      scrollLibraryTo({ top: restoreGroupScroll.current, behavior: "instant" });
      restoreGroupScroll.current = null;
    }
    if (
      !group &&
      restoreGroupFocus.current &&
      !inlineSearch.pending &&
      !inlineSearch.stale
    ) {
      if (groupOrigin.current.section !== section) {
        restoreGroupFocus.current = false;
        return;
      }
      const selector = groupOrigin.current.selector;
      let attempts = 0,
        frame = 0;
      const restore = () => {
        const requested = selector
          ? document.querySelector<HTMLElement>(selector)
          : null;
        if (selector && !requested && ++attempts < 12) {
          frame = requestAnimationFrame(restore);
          return;
        }
        const button =
          document.querySelector<HTMLElement>(
            selector ?? '.section-tabs [aria-selected="true"]',
          ) ??
          document.querySelector<HTMLElement>(
            '.section-tabs [aria-selected="true"]',
          );
        if (button && !button.closest("[inert]")) {
          button.focus({ preventScroll: true });
          restoreGroupFocus.current = false;
        }
      };
      frame = requestAnimationFrame(restore);
      return () => cancelAnimationFrame(frame);
    }
  }, [groupIdentity, section, inlineSearch.pending, inlineSearch.stale]);
  const refreshedCatalogRevision = useRef(catalogRevision);
  useEffect(() => {
    if (refreshedCatalogRevision.current === catalogRevision) return;
    refreshedCatalogRevision.current = catalogRevision;
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
  const settingsWrite = useSyncedSettings(settings, setSettings, act);
  useEffect(() => {
    const ids = [
      ...new Set([
        ...(player.trackId ? [player.trackId] : []),
        ...(modal === "queue" ? player.queue.slice(0, queueLimit) : []),
        ...(section === "year" && recap
          ? [
              ...recap.topTracks.map((item) => item.track.id),
              ...(recap.topAlbums ?? []).flatMap((item) =>
                item.trackId ? [item.trackId] : [],
              ),
            ]
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
    if (
      (section !== "year" && (recap || !catalog.catalogIndex)) ||
      !settings ||
      snapshotMode
    )
      return;
    const version = ++recapRequest.current;
    let active = true;
    setRecapLoading(true);
    setRecapError("");
    void (async () => {
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
    })();
    return () => {
      active = false;
    };
  }, [
    section,
    catalog.catalogIndex,
    recapSelection,
    settings,
    snapshotMode,
    recapRevision,
    player.playing,
    act,
  ]);
  useEffect(() => {
    if (section !== "year" || snapshotMode || shareRecap) return;
    const refresh = () => {
      if (!document.hidden) setRecapRevision((v) => v + 1);
    };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    const timer = window.setInterval(refresh, player.playing ? 15000 : 60000);
    return () => {
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
      if (timer) window.clearInterval(timer);
    };
  }, [section, snapshotMode, shareRecap, player.playing]);
  useEffect(() => {
    const listener = (e: KeyboardEvent) => {
      if (
        (e.target as HTMLElement).closest(
          "input,select,textarea,[contenteditable=true]",
        ) ||
        modal ||
        menu ||
        hasOpenMenu() ||
        selectionMode ||
        shareRecap
      )
        return;
      if (
        e.code === "Space" &&
        player.trackId &&
        !(e.target as HTMLElement).closest("button,a[href]")
      ) {
        e.preventDefault();
        void act(() => api.toggle());
      }
      if (e.key === "/" && section !== "year") {
        e.preventDefault();
        setSearchOpen(true);
        requestAnimationFrame(() => searchInput.current?.focus());
      }
    };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, [
    modal,
    shareRecap,
    player.trackId,
    act,
    menu,
    searchOpen,
    selectionMode,
    section,
  ]);
  useEffect(() => {
    if (!notice) return;
    let timeout: ReturnType<typeof setTimeout>;
    const dismiss = () => {
      if (document.querySelector(".toast:focus-within")) {
        timeout = setTimeout(dismiss, 1000);
        return;
      }
      setNotice("");
    };
    timeout = setTimeout(dismiss, 4500);
    return () => clearTimeout(timeout);
  }, [notice]);
  useEffect(() => {
    if (!state.detail || state.detail.sourceUri) return;
    let live = true;
    void api
      .tracksById([state.detail.id])
      .then(([track]) => {
        if (live && track) state.setDetail(track);
      })
      .catch((e) => setError(String(e)));
    return () => {
      live = false;
    };
  }, [state.detail?.id]);
  const current = player.trackId ? cache[player.trackId] : undefined;
  function backGroup() {
    const previous = groupStack.current.pop();
    if (previous) {
      restoreGroupScroll.current = previous.scroll;
      restoreNestedGroupFocus.current = previous.selector ?? null;
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
  useBackLayer(
    section === "year" &&
      !modal &&
      (!searchOpen || section === "year") &&
      !menu,
    () => setSection("songs"),
  );
  useBackLayer(
    !!group && !modal && !searchOpen && !inlineSearch.active && !menu,
    backGroup,
  );
  useBackLayer(
    section === "playlists" &&
      !!selectedList &&
      !modal &&
      !searchOpen &&
      !inlineSearch.active &&
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
    captureLibraryPosition();
    restoreGroupScroll.current = null;
    if (
      group?.kind === kind &&
      (group.id && g.id
        ? group.id === g.id
        : group.title === g.title && group.subtitle === g.subtitle)
    ) {
      setArtistView("tracks");
      scrollLibraryTo({ top: 0, behavior: "instant" });
      return;
    }
    if (!group) {
      groupScroll.current = libraryScrollTop();
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
      groupStack.current.push({
        group,
        scroll: libraryScrollTop(),
        artistView,
        selector: source?.dataset.groupKey
          ? `[data-group-key="${CSS.escape(source.dataset.groupKey)}"]`
          : undefined,
      });
    const image = source?.querySelector<HTMLImageElement>("img");
    coverOrigin.current = image
      ? { rect: image.getBoundingClientRect(), src: image.src }
      : null;
    setSection(kind);
    const selected = {
      kind,
      id: g.id,
      title: g.title,
      subtitle: g.subtitle,
      ids: g.ids,
      coverTrack: g.track,
    };
    setGroup(selected);
    setGroupTracks([]);
    const opening = refreshGroup(selected, 60, false);
    const version = groupRequest.current;
    void act(async () => {
      await opening;
      if (version === groupRequest.current) {
        setArtistView("tracks");
        scrollLibraryTo({ top: 0, behavior: "instant" });
      }
    });
  }
  useEffect(() => {
    const origin = coverOrigin.current,
      node = detailHero.current;
    if (!group || !origin || !node) return;
    coverOrigin.current = null;
    if (document.documentElement.dataset.layout === "phone") return;
    return animateCover(origin.rect, node.getBoundingClientRect(), origin.src);
  }, [group?.title, group?.kind]);
  useEffect(() => {
    if (group && !restoreNestedGroupFocus.current)
      document
        .querySelector<HTMLElement>(".library-page h1")
        ?.focus({ preventScroll: true });
  }, [group?.title, group?.kind]);
  useLayoutEffect(() => {
    const selector = restoreNestedGroupFocus.current;
    if (
      !selector ||
      !group ||
      inlineSearch.pending ||
      inlineSearch.stale ||
      state.groupLoading
    )
      return;
    const frame = requestAnimationFrame(() => {
      const button = document.querySelector<HTMLElement>(selector);
      if (button && !button.closest("[inert]")) {
        button.focus({ preventScroll: true });
        restoreNestedGroupFocus.current = null;
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [
    groupIdentity,
    artistView,
    state.groupLoading,
    inlineSearch.pending,
    inlineSearch.stale,
  ]);
  async function openEqualizer() {
    if (desktopWindows.supported)
      await act(() =>
        desktop.action({ op: "open", view: "equalizer", queue: false }),
      );
    else setModal("equalizer");
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
    generationRevision: personalization.generationRevision,
    prepareAnalysis: personalization.prepareAnalysis,
    collectionRequest: groupRequest,
  });

  function newPlaylist() {
    ++groupRequest.current;
    state.setManualTitle("");
    state.setManualIds([]);
    setModal("manual");
  }
  const desktopMenu = useDesktopMenu({
    supported: desktopWindows.supported && !!settings,
    language: settings?.language ?? "en",
    section,
    player,
    blocked:
      !!modal ||
      !!shareRecap ||
      state.busy ||
      state.chooserOpen ||
      selectionMode ||
      state.editingList,
    pending: false,
    onError: setError,
    dispatch: async (command) => {
      dismissMenu();
      state.setMenu(null);
      if (
        ["songs", "albums", "artists", "playlists", "year"].includes(command)
      ) {
        if (document.activeElement?.getAttribute("role") === "tab")
          (document.activeElement as HTMLElement).blur();
        motion.choose(command as LibrarySection);
        return;
      }
      switch (command) {
        case "import":
          await actions.doImport();
          break;
        case "new-playlist":
          newPlaylist();
          break;
        case "settings":
          setModal("settings");
          break;
        case "search":
          if (searchOpen) searchInput.current?.focus();
          else {
            nativeSearchFocus.current = true;
            setSearchOpen(true);
          }
          break;
        case "toggle":
          await api.toggle();
          break;
        case "previous":
          await api.previous();
          break;
        case "next":
          await api.next();
          break;
        case "shuffle":
          await api.setShuffle(!player.shuffle);
          break;
        case "repeat-off":
        case "repeat-all":
        case "repeat-one":
          await api.setRepeat(command.slice(7) as "off" | "all" | "one");
          break;
        case "player":
        case "queue":
          setModal(command);
          break;
        case "detach-player":
          await desktop.action({ op: "open", view: "player", queue: false });
          break;
        case "visualizer":
          await desktop.action({
            op: "open",
            view: "visualizer",
            queue: false,
          });
          break;
        case "equalizer":
          await openEqualizer();
          break;
        case "about":
          await invoke("desktop_about", { op: "open", dark: false });
          break;
        case "help":
          setModal(command);
          break;
      }
    },
  });

  const playlistTracks =
    (selectedList ?? generated)?.trackIds
      .map((id) => cache[id])
      .filter((x): x is Track => !!x && !x.hidden) ?? [];
  useMainWindows(state, {
    remember,
    openGroup,
    setModal,
    dismissModals,
    act,
    refresh,
    refreshLists,
  });
  return {
    ...state,
    ...personalization,
    soundController,
    automatic,
    setModal,
    dismissModals,
    shareLabel,
    ...catalog,
    total: !group && onlyFavorites ? visible.length : state.total,
    ...actions,
    selectedGroupPage,
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
    newPlaylist,
    desktopMenu,
    formatMinutes,
    formatMusicCount,
    formatDate,
    playlistTracks:
      inlineSearch.active && selectedList
        ? (inlineSearch.page?.tracks ?? playlistTracks)
        : playlistTracks,
    allPlaylistTracks: playlistTracks,
    visible:
      inlineSearch.active &&
      (group || section === "songs") &&
      !(group?.kind === "artists" && artistView === "albums")
        ? (inlineSearch.page?.tracks ?? visible)
        : visible,
    catalogGroups:
      inlineSearch.active &&
      !group &&
      (section === "albums" || section === "artists")
        ? (inlineSearch.page?.groups ?? catalogGroups)
        : catalogGroups,
    artistAlbums:
      inlineSearch.active &&
      group?.kind === "artists" &&
      artistView === "albums"
        ? (inlineSearch.page?.groups ?? state.artistAlbums)
        : state.artistAlbums,
    filteredLists:
      inlineSearch.active && !selectedList && section === "playlists"
        ? (inlineSearch.page?.lists ?? state.lists)
        : state.lists,
    filteredAutomatic:
      inlineSearch.active && !selectedList && section === "playlists"
        ? (inlineSearch.page?.automatic ?? automatic.playlists)
        : automatic.playlists,
    inlineSearch,
  };
}
