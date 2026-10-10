import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  LoaderCircle,
  Music2,
  ListMusic,
  ChartNoAxesColumn,
  Search,
  Plus,
  ArrowUpRight,
  ArrowLeft,
  ArrowRight,
  Settings2,
  SlidersHorizontal,
  Heart,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Shuffle,
  Repeat,
  Repeat1,
  ChevronDown,
  Headphones,
  FolderOpen,
  Upload,
  Share2,
  Check,
  X,
  Shield,
  Disc3,
  Users,
  MoreHorizontal,
} from "lucide-react";
import TrackList from "./TrackList";
import { api, native } from "./api";
import { en, es } from "./i18n";
import {
  compareCatalogTracks,
  coverageThrough,
  recapYears,
  coverUrl,
  localDate,
  localMidnight,
} from "./domain";
import ShareRecap from "./ShareRecap";
import {
  Cover,
  TrackRow,
  IconButton,
  Modal,
  OrbitPoster,
  time,
} from "./components";
import type {
  Track,
  Playlist,
  PlaylistRequest,
  PlaybackSnapshot,
  Settings,
  Recap,
  CatalogGroup,
  ImportProgress,
} from "./types";
const blank: PlaybackSnapshot = {
  trackId: null,
  playing: false,
  positionMs: 0,
  durationMs: 0,
  queue: [],
  queueIndex: 0,
  shuffle: false,
  repeat: "off",
  excluded: false,
};
export default function App() {
  const [tab, setTab] = useState<"library" | "playlists" | "year">("library"),
    [section, setSection] = useState<"songs" | "albums" | "artists">("songs"),
    [tracks, setTracks] = useState<Track[]>([]),
    [total, setTotal] = useState(0),
    [cache, setCache] = useState<Record<string, Track>>({}),
    [query, setQuery] = useState(""),
    [searchOpen, setSearchOpen] = useState(false),
    [onlyFavorites, setOnlyFavorites] = useState(false),
    [sort, setSort] = useState<"title" | "artist" | "album">("title"),
    [group, setGroup] = useState<{
      kind: "albums" | "artists";
      title: string;
      subtitle: string;
      ids: string[];
    } | null>(null);
  const [groupTracks, setGroupTracks] = useState<Track[]>([]),
    [groupLoading, setGroupLoading] = useState(false);
  const [catalogGroups, setCatalogGroups] = useState<CatalogGroup[]>([]),
    [groupsTotal, setGroupsTotal] = useState(0),
    [queueLimit, setQueueLimit] = useState(60);
  const [settings, setSettings] = useState<Settings>(),
    [player, setPlayer] = useState(blank),
    [lists, setLists] = useState<Playlist[]>([]),
    [selectedList, setSelectedList] = useState<Playlist | null>(null),
    [generated, setGenerated] = useState<Playlist | null>(null),
    [recap, setRecap] = useState<Recap>(),
    [shareRecap, setShareRecap] = useState<Recap | null>(null),
    [recapLoading, setRecapLoading] = useState(false),
    [recapRevision, setRecapRevision] = useState(0),
    [snapshotMode, setSnapshotMode] = useState(false),
    [snapshots, setSnapshots] = useState<Recap[]>([]),
    [year, setYear] = useState(new Date().getFullYear()),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState(""),
    [error, setError] = useState("");
  const [modal, setModal] = useState<
      | "settings"
      | "player"
      | "queue"
      | "manual"
      | "track"
      | "snapshots"
      | "story"
      | null
    >(null),
    [detail, setDetail] = useState<Track | null>(null),
    [story, setStory] = useState(0),
    [pickerTracks, setPickerTracks] = useState<Track[]>([]),
    [pickerTotal, setPickerTotal] = useState(0),
    [pickerQuery, setPickerQuery] = useState(""),
    [manualTitle, setManualTitle] = useState(""),
    [manualIds, setManualIds] = useState<string[]>([]),
    [editingList, setEditingList] = useState(false);
  const [request, setRequest] = useState<PlaylistRequest>({
      title: "",
      targetCount: 25,
      genre: "",
      includeArtist: "",
      excludeArtist: "",
      preferFavorites: false,
      avoidHeardToday: false,
    }),
    [targetMode, setTargetMode] = useState<"count" | "duration">("count"),
    [target, setTarget] = useState(25);
  const [catalogRevision, setCatalogRevision] = useState(0);
  const [chooserOpen, setChooserOpen] = useState(false);
  const [importProgress, setImportProgress] = useState<ImportProgress | null>(
    null,
  );
  const importActive = useRef(false);
  const latestQuery = useRef(query);
  latestQuery.current = query;
  const settingsWrite = useRef<Promise<void>>(Promise.resolve());
  const fileInput = useRef<HTMLInputElement>(null),
    folderInput = useRef<HTMLInputElement>(null),
    searchInput = useRef<HTMLInputElement>(null);
  const t = settings?.language === "es" ? es : en;
  const liveYears = settings
    ? recapYears(settings)
    : [new Date().getFullYear()];
  const yearOptions =
    snapshotMode && recap && !liveYears.includes(recap.year)
      ? [...liveYears, recap.year].sort((a, b) => b - a)
      : liveYears;
  const calendarReady = useRef(false);
  useEffect(() => {
    if (!settings || snapshotMode) return;
    if (!calendarReady.current) {
      calendarReady.current = true;
      setYear(liveYears[0]);
    } else if (!liveYears.includes(year)) setYear(liveYears[0]);
  }, [
    settings?.timeZone,
    liveYears[0],
    liveYears[liveYears.length - 1],
    year,
    snapshotMode,
  ]);
  const act = useCallback(async (fn: () => Promise<unknown>) => {
    setError("");
    try {
      return await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);
  const remember = useCallback(
    (ts: Track[]) =>
      setCache((c) => ({
        ...c,
        ...Object.fromEntries(ts.map((x) => [x.id, x])),
      })),
    [],
  );
  const libraryOptions = useRef({ favoriteOnly: onlyFavorites, sort });
  libraryOptions.current = { favoriteOnly: onlyFavorites, sort };
  const libraryRequest = useRef(0);
  const groupRequest = useRef(0);
  const groupsRequest = useRef(0);
  const refresh = useCallback(
    async (q = "", offset = 0) => {
      const version = offset
        ? libraryRequest.current
        : ++libraryRequest.current;
      const p = await api.listTracks(q, offset, 60, libraryOptions.current);
      if (version !== libraryRequest.current) return;
      setTracks((old) => (offset ? [...old, ...p.tracks] : p.tracks));
      setTotal(p.total);
      remember(p.tracks);
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
  const refreshGroups = useCallback(
    async (kind: "albums" | "artists", offset = 0) => {
      const version = offset ? groupsRequest.current : ++groupsRequest.current;
      const p = await api.groups(kind, offset);
      if (version !== groupsRequest.current) return;
      setCatalogGroups((old) => (offset ? [...old, ...p.groups] : p.groups));
      setGroupsTotal(p.total);
      remember(p.groups.map((g) => g.track));
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
  useEffect(() => {
    void act(async () => {
      setSettings(await api.settings());
      await refresh();
      await refreshLists();
    });
    let unsubscribe: (() => void) | undefined;
    let disposed = false;
    void api
      .subscribe((s) => {
        setPlayer(s);
        if (s.error) setError(s.error);
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
    if (tab === "library" && section !== "songs")
      void act(() => refreshGroups(section));
  }, [tab, section, total, catalogRevision, act, refreshGroups]);
  const groupIdentity = group
    ? JSON.stringify([group.kind, group.title, group.subtitle])
    : "";
  useEffect(() => {
    if (group)
      void act(() => refreshGroup(group, Math.max(60, groupTracks.length)));
  }, [catalogRevision, groupIdentity, refreshGroup, act]);
  function closeGroup() {
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
      document.documentElement.dataset.theme = settings.theme;
      settingsWrite.current = api.saveSettings(settings);
      void act(() => settingsWrite.current);
    }
  }, [settings]);
  useEffect(() => {
    const ids = [
      ...new Set([
        ...(player.trackId ? [player.trackId] : []),
        ...(modal === "queue" ? player.queue.slice(0, queueLimit) : []),
      ]),
    ].filter((id) => !cache[id]);
    if (ids.length) void act(async () => remember(await api.tracksById(ids)));
  }, [player.queue, player.trackId, cache, modal, queueLimit, act, remember]);
  const recapRequest = useRef(0);
  useEffect(() => {
    if (tab !== "year" || !settings || snapshotMode) return;
    const version = ++recapRequest.current;
    let active = true;
    setRecapLoading(true);
    void act(async () => {
      try {
        await settingsWrite.current;
        const result = await api.recap(year);
        const saved = await api.snapshots();
        if (!active || version !== recapRequest.current) return;
        setRecap(result);
        setSnapshots(saved);
      } finally {
        if (active && version === recapRequest.current) setRecapLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, [tab, year, settings, snapshotMode, recapRevision, player.playing, act]);
  useEffect(() => {
    if (tab !== "year" || snapshotMode || shareRecap) return;
    const refresh = () => setRecapRevision((v) => v + 1);
    window.addEventListener("focus", refresh);
    const timer = player.playing
      ? window.setInterval(refresh, 15000)
      : undefined;
    return () => {
      window.removeEventListener("focus", refresh);
      if (timer) window.clearInterval(timer);
    };
  }, [tab, snapshotMode, shareRecap, player.playing]);
  useEffect(() => {
    const listener = (e: KeyboardEvent) => {
      if (
        /INPUT|SELECT|TEXTAREA/.test((e.target as HTMLElement).tagName) ||
        modal ||
        shareRecap
      )
        return;
      if (e.code === "Space" && player.trackId) {
        e.preventDefault();
        void act(() => api.toggle());
      }
      if (e.key === "/") {
        e.preventDefault();
        setTab("library");
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, [modal, shareRecap, player.trackId, act]);
  useEffect(() => {
    if (!notice) return;
    const timeout = setTimeout(() => setNotice(""), 4500);
    return () => clearTimeout(timeout);
  }, [notice]);
  const current = player.trackId ? cache[player.trackId] : undefined;
  const formatMinutes = (ms: number) =>
    ms > 0 && ms < 60000
      ? "<1"
      : Math.round(ms / 60000).toLocaleString(settings?.language);
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
        ? groupTracks
        : tracks
            .filter((x) => !onlyFavorites || x.favorite)
            .sort((a, b) => compareCatalogTracks(a, b, sort)),
    [tracks, groupTracks, onlyFavorites, group, sort],
  );
  const rows = (
    ts: Track[],
    queueIds = ts.map((x) => x.id),
    editable?: boolean,
  ) => (
    <TrackList
      count={ts.length}
      render={(i) => {
        const track = ts[i];
        return (
          <TrackRow
            key={track.id}
            track={track}
            index={editable ? i : undefined}
            playing={player.trackId === track.id && player.playing}
            unknownArtist={t.unknownArtist}
            labels={t}
            onPlay={() =>
              void act(() =>
                api.play(
                  queueIds.includes(track.id) ? queueIds : [track.id],
                  Math.max(0, queueIds.indexOf(track.id)),
                ),
              )
            }
            onFavorite={() => void favorite(track)}
            onMore={() => {
              setDetail(track);
              setModal("track");
            }}
            edit={
              editable
                ? {
                    up: i ? () => moveList(i, -1) : undefined,
                    down: i < ts.length - 1 ? () => moveList(i, 1) : undefined,
                    remove: () => {
                      if (selectedList)
                        setSelectedList({
                          ...selectedList,
                          trackIds: selectedList.trackIds.filter(
                            (id) => id !== track.id,
                          ),
                        });
                    },
                  }
                : undefined
            }
          />
        );
      }}
    />
  );
  async function favorite(track: Track) {
    await act(async () => {
      await api.setFavorite(track.id, !track.favorite);
      const next = { ...track, favorite: !track.favorite };
      remember([next]);
      setTracks((ts) => ts.map((x) => (x.id === track.id ? next : x)));
      setGroupTracks((ts) => ts.map((x) => (x.id === track.id ? next : x)));
      if (detail?.id === track.id) setDetail(next);
      if (onlyFavorites && !group) await refresh(query);
    });
  }
  async function doImport(files?: File[], mode?: "library" | "folder") {
    if (importActive.current) return;
    importActive.current = true;
    setBusy(true);
    setNotice("");
    const waitingForFolder = native && !/Android/i.test(navigator.userAgent);
    setChooserOpen(waitingForFolder);
    setImportProgress(waitingForFolder ? null : { imported: 0, failed: 0 });
    let selectionMade = !waitingForFolder;
    let refreshing: Promise<void> | undefined;
    let pending = false;
    const refreshBatch = () => {
      pending = true;
      if (refreshing) return;
      refreshing = (async () => {
        while (pending) {
          pending = false;
          await refresh(latestQuery.current);
          setCatalogRevision((revision) => revision + 1);
        }
      })()
        .catch((e) => setError(String(e)))
        .finally(() => {
          refreshing = undefined;
        });
    };
    try {
      await act(async () => {
        const n = await api.importMusic(files, mode, (progress) => {
          selectionMade = true;
          setChooserOpen(false);
          setImportProgress(progress);
          if (progress.imported + progress.failed > 0) refreshBatch();
        });
        await refreshing;
        if (selectionMade) setNotice(n + " " + t.imported);
      });
    } finally {
      await refreshing;
      try {
        await refresh(latestQuery.current);
        setCatalogRevision((revision) => revision + 1);
      } catch (e) {
        setError(String(e));
      }
      importActive.current = false;
      setChooserOpen(false);
      setImportProgress(null);
      setBusy(false);
    }
  }
  async function samples() {
    setBusy(true);
    await act(async () => {
      await api.addSamples();
      await refresh();
      setNotice(t.soundOn);
    });
    setBusy(false);
  }
  async function openPlaylist(p: Playlist) {
    await act(async () => {
      remember(await api.tracksById(p.trackIds));
      setSelectedList(p);
      setGenerated(null);
      setEditingList(false);
    });
  }
  function moveList(i: number, d: number) {
    if (!selectedList) return;
    const ids = [...selectedList.trackIds];
    [ids[i], ids[i + d]] = [ids[i + d], ids[i]];
    setSelectedList({ ...selectedList, trackIds: ids });
  }
  async function saveList(p: Playlist) {
    await act(async () => {
      await api.savePlaylist(p);
      await refreshLists();
      setNotice(t.playlistSaved);
    });
  }
  async function buildMix() {
    setBusy(true);
    await act(async () => {
      const p = await api.generatePlaylist({
        ...request,
        title: request.title || t.makePlaylist,
        targetCount: targetMode === "count" ? target : undefined,
        targetMinutes: targetMode === "duration" ? target : undefined,
      });
      if (!p.trackIds.length) {
        setError(t.noCandidates);
        return;
      }
      remember(await api.tracksById(p.trackIds));
      setGenerated(p);
    });
    setBusy(false);
  }
  const playlistTracks =
    (selectedList ?? generated)?.trackIds
      .map((id) => cache[id])
      .filter((x): x is Track => !!x) ?? [];

  const nav = (
    <>
      <button
        className={tab === "library" ? "selected" : ""}
        onClick={() => {
          setTab("library");
          closeGroup();
          void act(() => refresh(query));
        }}
      >
        <Music2 />
        <span>{t.library}</span>
      </button>
      <button
        className={tab === "playlists" ? "selected" : ""}
        onClick={() => setTab("playlists")}
      >
        <ListMusic />
        <span>{t.playlists}</span>
      </button>
      <button
        className={tab === "year" ? "selected" : ""}
        onClick={() => setTab("year")}
      >
        <ChartNoAxesColumn />
        <span>{t.year}</span>
      </button>
    </>
  );
  const progress = (
    <div className="progress">
      <input
        type="range"
        aria-label={t.duration}
        min={0}
        max={Math.max(1, player.durationMs)}
        value={Math.min(player.positionMs, player.durationMs)}
        style={
          {
            "--progress":
              (player.positionMs / Math.max(1, player.durationMs)) * 100 + "%",
          } as React.CSSProperties
        }
        onChange={(e) => void act(() => api.seek(Number(e.target.value)))}
      />
      <div>
        <span>{time(player.positionMs)}</span>
        <span>{time(player.durationMs)}</span>
      </div>
    </div>
  );
  const transport = (
    <div className="transport">
      <IconButton
        label={t.shuffle}
        active={player.shuffle}
        onClick={() => void act(() => api.setShuffle(!player.shuffle))}
      >
        <Shuffle size={21} />
      </IconButton>
      <IconButton
        label={t.previous}
        onClick={() => void act(() => api.previous())}
      >
        <SkipBack size={26} fill="currentColor" />
      </IconButton>
      <button
        className="play-circle"
        aria-label={player.playing ? t.pause : t.play}
        onClick={() => void act(() => api.toggle())}
      >
        {player.playing ? (
          <Pause size={28} fill="currentColor" />
        ) : (
          <Play size={28} fill="currentColor" />
        )}
      </button>
      <IconButton label={t.next} onClick={() => void act(() => api.next())}>
        <SkipForward size={26} fill="currentColor" />
      </IconButton>
      <IconButton
        label={t.repeat + ": " + player.repeat}
        active={player.repeat !== "off"}
        onClick={() =>
          void act(() =>
            api.setRepeat(
              player.repeat === "off"
                ? "all"
                : player.repeat === "all"
                  ? "one"
                  : "off",
            ),
          )
        }
      >
        {player.repeat === "one" ? <Repeat1 size={21} /> : <Repeat size={21} />}
      </IconButton>
    </div>
  );
  const monthObserved = (r: Recap, i: number) =>
    Date.parse(r.coveredFrom) < localMidnight(r.year, i + 1, 1, r.timeZone) &&
    Date.parse(r.coveredThrough) >= localMidnight(r.year, i, 1, r.timeZone);
  const monthChart = recap && (
    <div
      className="month-chart"
      role="img"
      aria-label={recap.months
        .map(
          (ms, i) =>
            new Intl.DateTimeFormat(settings?.language, {
              month: "long",
              timeZone: "UTC",
            }).format(new Date(Date.UTC(2000, i, 1))) +
            ": " +
            (monthObserved(recap, i)
              ? Math.round(ms / 60000) + " " + t.minutes
              : t.unobserved),
        )
        .join("; ")}
    >
      {recap.months.map((ms, i) => {
        const observed = monthObserved(recap, i);
        return (
          <div
            key={i}
            className={observed ? "" : "unobserved"}
            title={
              observed ? Math.round(ms / 60000) + " " + t.minutes : t.unobserved
            }
          >
            <div className="bar-wrap">
              <span
                style={{
                  height:
                    (ms
                      ? Math.max(3, (ms / Math.max(...recap.months, 1)) * 100)
                      : 0) + "%",
                }}
              />
            </div>
            <small>
              {new Intl.DateTimeFormat(settings?.language, {
                month: "short",
                timeZone: "UTC",
              }).format(new Date(Date.UTC(2000, i, 1)))}
            </small>
          </div>
        );
      })}
    </div>
  );
  return (
    <div className="app-shell">
      <aside className="sidebar" inert={chooserOpen}>
        <a
          href="#"
          className="brand"
          onClick={(e) => {
            e.preventDefault();
            setTab("library");
          }}
        >
          <span className="brand-mark">
            <Music2 size={22} />
          </span>
          <span>
            local<span className="brand-period">.</span>
          </span>
        </a>
        <p className="sidebar-caption">YOUR MUSIC. YOUR YEAR.</p>
        <nav aria-label="Main navigation">{nav}</nav>
        <div className="sidebar-bottom">
          <div className="local-note">
            <Shield size={16} />
            <span>
              {settings?.language === "es"
                ? "Solo en tu dispositivo"
                : "Yours, on your device"}
            </span>
          </div>
          <button
            className="sidebar-settings"
            onClick={() => setModal("settings")}
          >
            <Settings2 size={18} />
            {t.settings}
          </button>
          {!native && (
            <p className="preview-note" title={t.previewHint}>
              {t.preview}
              <span>↗</span>
            </p>
          )}
        </div>
      </aside>
      <div className="content-shell" inert={chooserOpen}>
        <header className="mobile-brand">
          <span className="brand">
            local<span className="brand-period">.</span>
          </span>
          <IconButton label={t.settings} onClick={() => setModal("settings")}>
            <Settings2 size={20} />
          </IconButton>
        </header>
        <main>
          {importProgress && (
            <div
              className="import-status"
              role="status"
              aria-live="polite"
              aria-atomic="true"
            >
              <LoaderCircle
                className="import-spinner"
                size={22}
                aria-hidden="true"
              />
              <div>
                <strong>{t.importing}</strong>
                <span>
                  {importProgress.imported} {t.imported}
                  {importProgress.failed > 0
                    ? ` · ${importProgress.failed} ${t.importFailed}`
                    : ""}
                </span>
              </div>
              <button
                className="text-button"
                onClick={() => void act(() => api.cancelImport())}
              >
                {t.cancel}
              </button>
            </div>
          )}
          {tab === "library" && (
            <section className="library-page">
              <div className="page-heading">
                <div>
                  <p className="eyebrow">{t.local}</p>
                  <h1>{group?.title || t.library}</h1>
                </div>
                <div className="heading-actions">
                  <IconButton
                    label={t.search}
                    onClick={() => setSearchOpen(!searchOpen)}
                  >
                    <Search size={25} />
                  </IconButton>
                  <button
                    className="button primary desktop-import"
                    onClick={() =>
                      native ? void doImport() : fileInput.current?.click()
                    }
                    disabled={busy}
                  >
                    <Plus size={18} />
                    {t.import}
                  </button>
                  <IconButton
                    label={t.settings}
                    onClick={() => setModal("settings")}
                  >
                    <MoreHorizontal size={25} />
                  </IconButton>
                </div>
              </div>
              {searchOpen && (
                <div className="search-box">
                  <Search size={19} />
                  <input
                    ref={searchInput}
                    type="search"
                    placeholder={t.search}
                    aria-label={t.search}
                    value={query}
                    onChange={(e) => {
                      closeGroup();
                      setSection("songs");
                      setQuery(e.target.value);
                    }}
                  />
                  <IconButton
                    label={t.close}
                    onClick={() => {
                      setQuery("");
                      setSearchOpen(false);
                    }}
                  >
                    <X size={18} />
                  </IconButton>
                </div>
              )}
              {group ? (
                <button
                  className="text-button group-back"
                  onClick={() => {
                    closeGroup();
                    void act(() => refresh(query));
                  }}
                >
                  <ArrowLeft size={17} />
                  {t.library}
                </button>
              ) : (
                <div
                  className="section-tabs"
                  role="tablist"
                  aria-label={t.library}
                >
                  {(["songs", "albums", "artists"] as const).map((x) => (
                    <button
                      key={x}
                      role="tab"
                      aria-selected={section === x}
                      onClick={() => {
                        setSection(x);
                        setOnlyFavorites(false);
                      }}
                    >
                      {t[x]}
                    </button>
                  ))}
                </div>
              )}
              <div className="library-toolbar">
                <div>
                  <button
                    className={
                      "filter-button" + (!onlyFavorites ? " chosen" : "")
                    }
                    onClick={() => setOnlyFavorites(false)}
                  >
                    {t.allMusic}
                  </button>
                  <span className="count-dot">·</span>
                  <span>
                    {(group ? group.ids.length : total).toLocaleString(
                      settings?.language,
                    )}{" "}
                    {t.songCount}
                  </span>
                </div>
                <div className="toolbar-actions">
                  {section === "songs" && !group && (
                    <>
                      <IconButton
                        label={t.favorites}
                        active={onlyFavorites}
                        onClick={() => setOnlyFavorites(!onlyFavorites)}
                      >
                        <Heart size={18} />
                      </IconButton>
                      <label className="sort-select">
                        <SlidersHorizontal size={18} />
                        <select
                          aria-label={t.sort}
                          value={sort}
                          onChange={(e) =>
                            setSort(e.target.value as typeof sort)
                          }
                        >
                          <option value="title">{t.sort}</option>
                          <option value="artist">{t.sortArtist}</option>
                          <option value="album">{t.sortAlbum}</option>
                        </select>
                      </label>
                    </>
                  )}
                  <IconButton
                    label={t.import}
                    disabled={busy}
                    onClick={() =>
                      native ? void doImport() : fileInput.current?.click()
                    }
                  >
                    <Plus size={20} />
                  </IconButton>
                </div>
              </div>

              {total === 0 && !query ? (
                <div className="empty-library">
                  <div className="empty-art">
                    <span />
                    <span />
                    <span />
                    <Music2 size={28} />
                  </div>
                  <p className="eyebrow">A COLLECTION THAT IS YOURS</p>
                  <h2>{t.emptyTitle}</h2>
                  <p>{t.emptyBody}</p>
                  <div className="empty-actions">
                    <button
                      className="button primary"
                      disabled={busy}
                      onClick={() =>
                        native ? void doImport() : fileInput.current?.click()
                      }
                    >
                      <Upload size={18} />
                      {t.import}
                    </button>
                    <button
                      className="button secondary"
                      disabled={busy}
                      onClick={() =>
                        native
                          ? void doImport(undefined, "folder")
                          : folderInput.current?.click()
                      }
                    >
                      <FolderOpen size={18} />
                      {t.importFolder}
                    </button>
                  </div>
                  <small>{t.emptyHint}</small>
                  {!native && (
                    <button
                      className="text-button sample-link"
                      disabled={busy}
                      onClick={() => void samples()}
                    >
                      {t.sample}
                      <ArrowUpRight size={16} />
                    </button>
                  )}
                </div>
              ) : section === "songs" || group ? (
                <>
                  {visible.length ? (
                    rows(visible, group?.ids ?? visible.map((x) => x.id))
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
                <div className="album-grid">
                  {catalogGroups.length ? (
                    catalogGroups.map((g) => (
                      <button
                        key={JSON.stringify([g.title, g.subtitle])}
                        className="album-card"
                        onClick={() => {
                          ++libraryRequest.current;
                          setGroupTracks([]);
                          setGroupLoading(true);
                          setGroup({
                            kind: section,
                            title: g.title,
                            subtitle: g.subtitle,
                            ids: g.ids,
                          });
                        }}
                      >
                        <Cover track={g.track} large />
                        <strong>{g.title}</strong>
                        <span>
                          {g.subtitle || g.ids.length + " " + t.tracks}
                          {section === "albums" && g.track.releaseYear
                            ? " · " + g.track.releaseYear
                            : ""}
                        </span>
                      </button>
                    ))
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
                        await refreshGroups(section, catalogGroups.length);
                      }
                    })
                  }
                >
                  {t.loadMore}
                </button>
              )}
            </section>
          )}
          {tab === "playlists" && (
            <section className="playlists-page">
              <div className="page-heading">
                <div>
                  <p className="eyebrow">{t.yourLibrary}</p>
                  <h1>{selectedList ? selectedList.title : t.playlists}</h1>
                </div>
                <button
                  className="button secondary"
                  onClick={() => {
                    setManualTitle("");
                    setManualIds([]);
                    setModal("manual");
                  }}
                >
                  <Plus size={18} />
                  {t.newPlaylist}
                </button>
              </div>
              {selectedList ? (
                <>
                  <div className="playlist-detail-head">
                    <button
                      className="text-button"
                      onClick={() => {
                        setSelectedList(null);
                        setEditingList(false);
                      }}
                    >
                      <ArrowLeft size={18} />
                      {t.playlists}
                    </button>
                    <span>
                      {playlistTracks.length} {t.tracks} ·{" "}
                      {Math.round(
                        playlistTracks.reduce((s, x) => s + x.durationMs, 0) /
                          60000,
                      )}{" "}
                      {t.minutes.toLowerCase()}
                    </span>
                    <button
                      className="text-button"
                      onClick={() => {
                        if (editingList) void saveList(selectedList);
                        setEditingList(!editingList);
                      }}
                    >
                      {editingList ? t.save : t.edit}
                    </button>
                  </div>
                  {rows(playlistTracks, selectedList.trackIds, editingList)}
                  <div className="playlist-footer">
                    <button
                      className="button primary"
                      disabled={!playlistTracks.length}
                      onClick={() =>
                        void act(() => api.play(selectedList.trackIds))
                      }
                    >
                      <Play size={18} />
                      {t.playMix}
                    </button>
                    <button
                      className="text-button danger"
                      onClick={() =>
                        void act(async () => {
                          if (
                            confirm(t.delete + " " + selectedList.title + "?")
                          ) {
                            await api.deletePlaylist(selectedList.id);
                            await refreshLists();
                            setSelectedList(null);
                          }
                        })
                      }
                    >
                      {t.delete}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="playlist-collection">
                    {lists.map((p) => (
                      <button
                        key={p.id}
                        className="playlist-tile"
                        onClick={() => void openPlaylist(p)}
                      >
                        <div className="playlist-tile-art">
                          <ListMusic size={35} />
                          <span>
                            {String(p.trackIds.length).padStart(2, "0")}
                          </span>
                        </div>
                        <div>
                          <p className="eyebrow">
                            {p.kind === "generated"
                              ? t.generated
                              : p.kind === "recap"
                                ? t.year
                                : t.manual}
                          </p>
                          <h3>{p.title}</h3>
                          <span>
                            {p.trackIds.length} {t.tracks}
                          </span>
                        </div>
                        <ArrowUpRight size={22} />
                      </button>
                    ))}
                  </div>
                  <div className="generator">
                    <div className="generator-title">
                      <div>
                        <p className="eyebrow">
                          01 / {t.generate.toUpperCase()}
                        </p>
                        <h2>{t.makePlaylist}</h2>
                        <p>{t.mixSubtitle}</p>
                      </div>
                      <span className="generator-mark">
                        <Shuffle />
                      </span>
                    </div>
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        void buildMix();
                      }}
                    >
                      <div className="generator-fields">
                        <label>
                          {t.playlistName}
                          <input
                            value={request.title}
                            placeholder={t.makePlaylist}
                            onChange={(e) =>
                              setRequest({ ...request, title: e.target.value })
                            }
                          />
                        </label>
                        <label>
                          {t.target}
                          <div className="joined-input">
                            <select
                              aria-label={t.target}
                              value={targetMode}
                              onChange={(e) => {
                                const mode = e.target
                                  .value as typeof targetMode;
                                setTargetMode(mode);
                                setTarget(mode === "count" ? 25 : 45);
                              }}
                            >
                              <option value="count">{t.trackCount}</option>
                              <option value="duration">{t.minutes}</option>
                            </select>
                            <input
                              aria-label={
                                targetMode === "count" ? t.count : t.minutes
                              }
                              type="number"
                              min="1"
                              max={targetMode === "count" ? 100 : 600}
                              value={target}
                              onChange={(e) =>
                                setTarget(Number(e.target.value))
                              }
                              required
                            />
                          </div>
                        </label>
                        <label>
                          {t.genre}
                          <input
                            list="genres"
                            value={request.genre}
                            placeholder={t.anyGenre}
                            onChange={(e) =>
                              setRequest({ ...request, genre: e.target.value })
                            }
                          />
                          <datalist id="genres">
                            {[
                              ...new Set(
                                Object.values(cache)
                                  .map((x) => x.genre)
                                  .filter(Boolean),
                              ),
                            ].map((g) => (
                              <option key={g} value={g} />
                            ))}
                          </datalist>
                        </label>
                        <label>
                          {t.includeArtist}
                          <input
                            list="artists"
                            value={request.includeArtist}
                            placeholder={t.anyArtist}
                            onChange={(e) =>
                              setRequest({
                                ...request,
                                includeArtist: e.target.value,
                              })
                            }
                          />
                        </label>
                        <label>
                          {t.excludeArtist}
                          <input
                            list="artists"
                            value={request.excludeArtist}
                            placeholder="—"
                            onChange={(e) =>
                              setRequest({
                                ...request,
                                excludeArtist: e.target.value,
                              })
                            }
                          />
                          <datalist id="artists">
                            {[
                              ...new Set(
                                Object.values(cache)
                                  .map((x) => x.artist)
                                  .filter(Boolean),
                              ),
                            ].map((g) => (
                              <option key={g} value={g} />
                            ))}
                          </datalist>
                        </label>
                      </div>
                      <div className="generator-options">
                        <label className="check-label">
                          <input
                            type="checkbox"
                            checked={request.preferFavorites}
                            onChange={(e) =>
                              setRequest({
                                ...request,
                                preferFavorites: e.target.checked,
                              })
                            }
                          />
                          {t.preferFavorites}
                        </label>
                        <label className="check-label">
                          <input
                            type="checkbox"
                            checked={request.avoidHeardToday}
                            onChange={(e) =>
                              setRequest({
                                ...request,
                                avoidHeardToday: e.target.checked,
                              })
                            }
                          />
                          {t.avoidToday}
                        </label>
                        <span className="small-muted">
                          <Check size={15} />
                          {t.noRepeats}
                        </span>
                      </div>
                      <div className="generator-bottom">
                        <span className="small-muted">
                          <Shield size={16} />
                          {t.filters}
                        </span>
                        <button
                          className="button primary"
                          disabled={busy || !total}
                          type="submit"
                        >
                          {t.generate}
                          <ArrowRight size={18} />
                        </button>
                      </div>
                    </form>
                  </div>
                  {generated && (
                    <div className="generated-result">
                      <div className="result-heading">
                        <div>
                          <h2>{generated.title}</h2>
                          <span>
                            {playlistTracks.length} {t.tracks} ·{" "}
                            {Math.round(
                              playlistTracks.reduce(
                                (s, x) => s + x.durationMs,
                                0,
                              ) / 60000,
                            )}{" "}
                            {t.minutes.toLowerCase()}
                          </span>
                        </div>
                        <button
                          className="text-button"
                          onClick={() => void saveList(generated)}
                        >
                          <Plus size={17} />
                          {t.save}
                        </button>
                      </div>
                      {rows(playlistTracks, generated.trackIds)}
                      <button
                        className="button primary full-width"
                        onClick={() =>
                          void act(() => api.play(generated.trackIds))
                        }
                      >
                        <Play size={18} />
                        {t.playMix}
                      </button>
                    </div>
                  )}
                </>
              )}
            </section>
          )}
          {tab === "year" && (
            <section className="year-page">
              <div className="page-heading">
                <div>
                  <p className="eyebrow">
                    {t.yearLabel} {year}
                  </p>
                  <h1>{t.year}</h1>
                </div>
                <div className="year-controls">
                  <select
                    aria-label={t.year}
                    value={year}
                    onChange={(e) => {
                      setSnapshotMode(false);
                      setYear(Number(e.target.value));
                    }}
                  >
                    {yearOptions.map((y) => (
                      <option key={y}>{y}</option>
                    ))}
                  </select>
                  <IconButton
                    label={snapshotMode ? t.liveRecap : t.refreshRecap}
                    onClick={() => {
                      setSnapshotMode(false);
                      setRecapRevision((v) => v + 1);
                    }}
                  >
                    <Repeat size={20} />
                  </IconButton>
                  <IconButton
                    label={t.savedSnapshots}
                    onClick={() => setModal("snapshots")}
                  >
                    <MoreHorizontal />
                  </IconButton>
                </div>
              </div>
              <OrbitPoster
                year={recap?.year === year ? recap.year : year}
                seed={recap?.visualSeed ?? "ff6600"}
                label={t.inSound}
              />
              {recapLoading && (
                <p role="status" className="small-muted">
                  {t.loading}
                </p>
              )}
              {recap && recap.year === year && (
                <>
                  <div className="recap-coverage">
                    <span>
                      {snapshotMode
                        ? t.snapshot
                        : recap.completeYear
                          ? t.fullYear
                          : t.partialYear}
                    </span>
                    <span>
                      {t.since} {formatDate(recap.coveredFrom, recap.timeZone)}{" "}
                      · {t.through}{" "}
                      {formatDate(
                        coverageThrough(recap).toISOString(),
                        recap.timeZone,
                      )}
                    </span>
                  </div>
                  <div className="recap-total">
                    <strong>{formatMinutes(recap.listenedMs)}</strong>
                    <div>
                      <span className="eyebrow">{t.minutesListened}</span>
                      <small>
                        {recap.activeDays} {t.listeningDays} ·{" "}
                        {recap.qualifiedPlays} {t.qualifiedPlays}
                      </small>
                    </div>
                    <button
                      className="text-button"
                      onClick={() => {
                        setStory(0);
                        setModal("story");
                      }}
                    >
                      {t.viewRecap}
                      <ArrowUpRight size={18} />
                    </button>
                  </div>
                  {monthChart}
                  <p className="month-caption">
                    {recap.listenedMs ? t.monthStory : t.recapEmpty}
                  </p>
                  <div className="recap-highlights">
                    <div>
                      <span className="eyebrow">01 / {t.topArtist}</span>
                      <h2>{recap.topArtist?.name || "—"}</h2>
                      <span>
                        {recap.topArtist
                          ? recap.topArtist.plays + " " + t.plays
                          : t.noPlays}
                      </span>
                    </div>
                    <div>
                      <span className="eyebrow">02 / {t.topTrack}</span>
                      <h2>{recap.topTracks[0]?.track.title || "—"}</h2>
                      <span>
                        {recap.topTracks[0]
                          ? recap.topTracks[0].plays + " " + t.plays
                          : t.noPlays}
                      </span>
                    </div>
                    <div>
                      <span className="eyebrow">03 / {t.topAlbum}</span>
                      <h2>{recap.topAlbum?.name || "—"}</h2>
                      <span>{recap.topAlbum?.artist || t.noPlays}</span>
                    </div>
                  </div>
                  <div className="recap-actions">
                    <button
                      className="button primary"
                      disabled={!recap.trackIds.length}
                      onClick={() => void act(() => api.play(recap.trackIds))}
                    >
                      <Play size={18} />
                      {t.playYear}
                    </button>
                    <button
                      className="button secondary"
                      disabled={!recap.listenedMs || recapLoading}
                      onClick={() => {
                        setModal(null);
                        setShareRecap(recap);
                      }}
                    >
                      <Share2 size={18} />
                      {t.shareCard}
                    </button>
                    <button
                      className="text-button"
                      onClick={() =>
                        void act(async () => {
                          await api.saveSnapshot(recap);
                          setSnapshots(await api.snapshots());
                          setNotice(t.snapshotSaved);
                        })
                      }
                    >
                      {t.saveSnapshot}
                    </button>
                  </div>
                  {!recap.listenedMs && (
                    <p className="small-muted">{t.recapEmptyBody}</p>
                  )}
                  <p className="method-note">{t.coverageNote}</p>
                  {!!recap.topTracks.length && (
                    <div className="recap-track-list">
                      <p className="eyebrow">{t.yearTracks}</p>
                      {rows(
                        recap.topTracks.slice(0, 25).map((x) => x.track),
                        recap.trackIds,
                      )}
                    </div>
                  )}
                </>
              )}
            </section>
          )}
        </main>
        <footer className="page-footer">
          <span>LOCAL MUSIC / {new Date().getFullYear()}</span>
          <span>
            <Shield size={12} />
            {settings?.language === "es"
              ? "Privado por naturaleza"
              : "Private by nature"}
          </span>
        </footer>
      </div>
      {current && (
        <div className="mini-player">
          <button className="mini-track" onClick={() => setModal("player")}>
            <Cover track={current} />
            <span>
              <strong>{current.title}</strong>
              <small>{current.artist || t.unknownArtist}</small>
            </span>
            {current.demo && <span className="mini-sample">SAMPLE</span>}
          </button>
          <div className="mini-center">
            {transport}
            {progress}
          </div>
          <div className="mini-actions">
            <IconButton
              label={t.favorite}
              active={current.favorite}
              onClick={() => void favorite(current)}
            >
              <Heart
                size={19}
                fill={current.favorite ? "currentColor" : "none"}
              />
            </IconButton>
            <IconButton label={t.queue} onClick={() => setModal("queue")}>
              <ListMusic size={22} />
            </IconButton>
            <IconButton label={t.nowPlaying} onClick={() => setModal("player")}>
              <ArrowUpRight size={20} />
            </IconButton>
          </div>
          <div className="mobile-mini-play">
            <IconButton
              label={player.playing ? t.pause : t.play}
              onClick={() => void act(() => api.toggle())}
            >
              {player.playing ? (
                <Pause fill="currentColor" />
              ) : (
                <Play fill="currentColor" />
              )}
            </IconButton>
          </div>
          <span
            className="mini-progress"
            style={{
              width:
                Math.min(
                  100,
                  (player.positionMs / Math.max(1, player.durationMs)) * 100,
                ) + "%",
            }}
          />
        </div>
      )}
      <nav
        className="bottom-nav"
        aria-label="Mobile navigation"
        inert={chooserOpen}
      >
        {nav}
      </nav>
      <input
        hidden
        ref={fileInput}
        type="file"
        accept="audio/*,.flac,.opus,.ogg,.m4a"
        multiple
        onChange={(e) => {
          const selected = Array.from(e.target.files ?? []);
          if (selected.length) void doImport(selected);
          e.target.value = "";
        }}
      />
      <input
        hidden
        ref={folderInput}
        type="file"
        multiple
        {...({ webkitdirectory: "" } as object)}
        onChange={(e) => {
          const selected = Array.from(e.target.files ?? []);
          if (selected.length) void doImport(selected);
          e.target.value = "";
        }}
      />
      {chooserOpen && (
        <div className="chooser-shield" role="status" aria-live="polite">
          <FolderOpen size={24} aria-hidden="true" />
          <span>{t.selectImportFolder}</span>
        </div>
      )}
      {notice && (
        <div className="toast" role="status">
          <Check size={18} />
          {notice}
        </div>
      )}
      {error && (
        <div className="error-banner" role="alert">
          <div>
            <strong>{t.error}</strong>
            <span>{error}</span>
          </div>
          <IconButton label={t.close} onClick={() => setError("")}>
            <X size={18} />
          </IconButton>
        </div>
      )}
      {modal === "settings" && settings && (
        <Modal
          closeLabel={t.close}
          title={t.settings}
          onClose={() => setModal(null)}
        >
          <div className="settings-form">
            <label>
              {t.language}
              <select
                aria-label={t.language}
                value={settings.language}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    language: e.target.value as Settings["language"],
                  })
                }
              >
                <option value="en">English</option>
                <option value="es">Español</option>
              </select>
            </label>
            <label>
              {t.theme}
              <select
                aria-label={t.theme}
                value={settings.theme}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    theme: e.target.value as Settings["theme"],
                  })
                }
              >
                {(["system", "light", "dark"] as const).map((x) => (
                  <option key={x} value={x}>
                    {t[x]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {t.timeZone}
              <select
                aria-label={t.timeZone}
                value={settings.timeZone}
                onChange={(e) =>
                  setSettings({ ...settings, timeZone: e.target.value })
                }
              >
                {[
                  ...new Set([
                    settings.timeZone,
                    "UTC",
                    ...(typeof Intl.supportedValuesOf === "function"
                      ? Intl.supportedValuesOf("timeZone")
                      : [
                          "UTC",
                          "America/Los_Angeles",
                          "America/New_York",
                          "Europe/Madrid",
                        ]),
                  ]),
                ].map((z) => (
                  <option key={z}>{z}</option>
                ))}
              </select>
            </label>
            <div className="settings-history">
              <h3>{t.history}</h3>
              <p>
                {t.since} {formatDate(settings.historyEnabledSince)}
              </p>
              <button
                className="text-button danger"
                onClick={() =>
                  void act(async () => {
                    if (confirm(t.deleteWarning)) {
                      await api.deleteHistory();
                      const nextSettings = await api.settings();
                      const nextYear = recapYears(nextSettings)[0];
                      setSettings(nextSettings);
                      setSnapshotMode(false);
                      setYear(nextYear);
                      setRecap(await api.recap(nextYear));
                      setSnapshots([]);
                      setNotice(t.done);
                    }
                  })
                }
              >
                {t.deleteHistory}
              </button>
            </div>
            {!native && <p className="method-note">{t.previewHint}</p>}
          </div>
        </Modal>
      )}
      {modal === "player" && current && (
        <Modal
          closeLabel={t.close}
          title={t.nowPlaying}
          onClose={() => setModal(null)}
        >
          <div className="full-player">
            <p className="eyebrow">{t.playingFrom}</p>
            <Cover track={current} className="player-cover" large />
            <div className="player-title">
              <div>
                <h2>{current.title}</h2>
                <p>{current.artist || t.unknownArtist}</p>
              </div>
              <IconButton
                label={t.favorite}
                active={current.favorite}
                onClick={() => void favorite(current)}
              >
                <Heart
                  size={26}
                  fill={current.favorite ? "currentColor" : "none"}
                />
              </IconButton>
            </div>
            {progress}
            {transport}
            <div className="player-options">
              <button className="text-button" onClick={() => setModal("queue")}>
                <ListMusic size={20} />
                {t.queue}
              </button>
              <label className="check-label">
                <input
                  type="checkbox"
                  checked={player.excluded}
                  disabled={current.demo}
                  onChange={(e) => {
                    const value = e.currentTarget.checked;
                    setPlayer((p) => ({ ...p, excluded: value }));
                    void act(async () => {
                      try {
                        await api.setExcluded(value);
                      } catch (error) {
                        setPlayer(await api.playback());
                        throw error;
                      }
                    });
                  }}
                />
                <Shield size={16} />
                {t.private}
              </label>
            </div>
            {current.demo && <p className="small-muted">{t.sampleNote}</p>}
          </div>
        </Modal>
      )}
      {modal === "queue" && (
        <Modal
          closeLabel={t.close}
          title={t.queue}
          onClose={() => setModal(null)}
          wide
        >
          {player.queue.length ? (
            player.queue.slice(0, queueLimit).map(
              (id, i) =>
                cache[id] && (
                  <TrackRow
                    key={id + ":" + i}
                    track={cache[id]}
                    index={i}
                    playing={i === player.queueIndex && player.playing}
                    unknownArtist={t.unknownArtist}
                    labels={t}
                    onPlay={() => void act(() => api.play(player.queue, i))}
                    edit={{
                      up: i
                        ? () =>
                            void act(() => {
                              const ids = [...player.queue];
                              [ids[i], ids[i - 1]] = [ids[i - 1], ids[i]];
                              return api.reorderQueue(ids);
                            })
                        : undefined,
                      down:
                        i < player.queue.length - 1
                          ? () =>
                              void act(() => {
                                const ids = [...player.queue];
                                [ids[i], ids[i + 1]] = [ids[i + 1], ids[i]];
                                return api.reorderQueue(ids);
                              })
                          : undefined,
                      remove:
                        i !== player.queueIndex
                          ? () =>
                              void act(() =>
                                api.reorderQueue(
                                  player.queue.filter((_, n) => n !== i),
                                ),
                              )
                          : undefined,
                    }}
                  />
                ),
            )
          ) : (
            <p className="empty-small">{t.emptyQueue}</p>
          )}
          {player.queue.length > queueLimit && (
            <button
              className="button secondary full-width"
              onClick={() => setQueueLimit((n) => n + 60)}
            >
              {t.loadMore}
            </button>
          )}
        </Modal>
      )}
      {modal === "manual" && (
        <Modal
          closeLabel={t.close}
          title={t.newPlaylist}
          onClose={() => setModal(null)}
          wide
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!manualIds.length) {
                setError(t.emptySelection);
                return;
              }
              void act(async () => {
                await saveList({
                  id: crypto.randomUUID(),
                  title: manualTitle,
                  kind: "manual",
                  trackIds: manualIds,
                });
                setModal(null);
              });
            }}
          >
            <label>
              {t.playlistName}
              <input
                value={manualTitle}
                required
                maxLength={120}
                onChange={(e) => setManualTitle(e.target.value)}
              />
            </label>
            <p className="eyebrow choose-tracks-label">{t.chooseTracks}</p>
            <label>
              {t.search}
              <input
                value={pickerQuery}
                onChange={(e) => setPickerQuery(e.target.value)}
              />
            </label>
            <div className="track-picker">
              {pickerTracks.map((track) => (
                <label key={track.id}>
                  <input
                    type="checkbox"
                    checked={manualIds.includes(track.id)}
                    onChange={(e) =>
                      setManualIds((ids) =>
                        e.target.checked
                          ? [...ids, track.id]
                          : ids.filter((id) => id !== track.id),
                      )
                    }
                  />
                  <Cover track={track} />
                  <span>
                    <strong>{track.title}</strong>
                    <small>{track.artist || t.unknownArtist}</small>
                  </span>
                </label>
              ))}
            </div>
            {pickerTracks.length < pickerTotal && (
              <button
                className="text-button"
                type="button"
                onClick={() =>
                  void act(() =>
                    refreshPicker(pickerQuery, pickerTracks.length),
                  )
                }
              >
                {t.loadMore}
              </button>
            )}
            <button className="button primary full-width" type="submit">
              {t.save}
              <Check size={18} />
            </button>
          </form>
        </Modal>
      )}
      {modal === "track" && detail && (
        <Modal
          closeLabel={t.close}
          title={t.details}
          onClose={() => setModal(null)}
        >
          <div className="track-details">
            <Cover track={detail} large />
            <h2>{detail.title}</h2>
            <p>{detail.artist || t.unknownArtist}</p>
            <dl>
              <div>
                <dt>{t.albums}</dt>
                <dd>{detail.album || t.unknownAlbum}</dd>
              </div>
              <div>
                <dt>{t.genre}</dt>
                <dd>{detail.genre || "—"}</dd>
              </div>
              <div>
                <dt>{t.duration}</dt>
                <dd>{time(detail.durationMs)}</dd>
              </div>
            </dl>
            <button
              className="button secondary full-width"
              onClick={() => void favorite(detail)}
            >
              <Heart
                size={18}
                fill={detail.favorite ? "currentColor" : "none"}
              />
              {t.favorite}
            </button>
            <label>
              {t.addToPlaylist}
              <select
                defaultValue=""
                onChange={(e) =>
                  void act(async () => {
                    const p = lists.find((x) => x.id === e.target.value);
                    if (p) {
                      await saveList({
                        ...p,
                        trackIds: [...new Set([...p.trackIds, detail.id])],
                      });
                      setModal(null);
                    }
                  })
                }
              >
                <option value="" disabled>
                  {t.selectPlaylist}
                </option>
                {lists.map((p) => (
                  <option value={p.id} key={p.id}>
                    {p.title}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </Modal>
      )}
      {modal === "snapshots" && (
        <Modal
          closeLabel={t.close}
          title={t.savedSnapshots}
          onClose={() => setModal(null)}
        >
          {snapshots.length ? (
            snapshots.map((r, i) => (
              <button
                className="snapshot-row"
                key={i}
                onClick={() => {
                  ++recapRequest.current;
                  setYear(r.year);
                  setRecapLoading(false);
                  setRecap(r);
                  setSnapshotMode(true);
                  remember(r.topTracks.map((x) => x.track));
                  setModal(null);
                }}
              >
                <span>
                  {r.year} ·{" "}
                  {formatDate(coverageThrough(r).toISOString(), r.timeZone)}
                </span>
                <strong>
                  {formatMinutes(r.listenedMs)} {t.minutes.toLowerCase()}
                </strong>
                <ArrowUpRight size={18} />
              </button>
            ))
          ) : (
            <p className="empty-small">{t.noSnapshot}</p>
          )}
        </Modal>
      )}
      {shareRecap && (
        <ShareRecap
          recap={shareRecap}
          frozen={snapshotMode}
          language={settings?.language ?? "en"}
          onClose={() => setShareRecap(null)}
        />
      )}
      {modal === "story" && recap && (
        <Modal
          closeLabel={t.close}
          title={t.story}
          onClose={() => setModal(null)}
        >
          <div className="story-progress">
            {Array.from({ length: 6 }, (_, i) => (
              <button
                key={i}
                aria-label={String(i + 1)}
                className={i === story ? "current" : ""}
                onClick={() => setStory(i)}
              />
            ))}
          </div>
          <div className="story-scene">
            {story === 0 ? (
              <>
                <OrbitPoster
                  year={recap.year}
                  seed={recap.visualSeed}
                  label={t.inSound}
                />
                <h2>{t.year}</h2>
                <p>
                  {t.since} {formatDate(recap.coveredFrom, recap.timeZone)}
                </p>
              </>
            ) : story === 1 ? (
              <>
                <p className="eyebrow">{t.minutesListened}</p>
                <strong className="story-number">
                  {formatMinutes(recap.listenedMs)}
                </strong>
                <p>
                  {recap.activeDays} {t.listeningDays}
                </p>
              </>
            ) : story === 2 ? (
              <>
                <p className="eyebrow">{t.topTrack}</p>
                {recap.topTracks[0] && (
                  <Cover track={recap.topTracks[0].track} large />
                )}
                <h2>{recap.topTracks[0]?.track.title || t.noPlays}</h2>
                <p>{recap.topTracks[0]?.track.artist}</p>
              </>
            ) : story === 3 ? (
              <>
                <p className="eyebrow">{t.topArtist}</p>
                <h2>{recap.topArtist?.name || t.noPlays}</h2>
                <p className="eyebrow">{t.topAlbum}</p>
                <h2>{recap.topAlbum?.name || "—"}</h2>
              </>
            ) : story === 4 ? (
              <>
                <p className="eyebrow">{t.monthTitle}</p>
                {monthChart}
                <p>{t.monthStory}</p>
              </>
            ) : (
              <>
                <p className="eyebrow">{t.yearTracks}</p>
                <h2>
                  {recap.trackIds.length} {t.tracks}
                </h2>
                <button
                  className="button primary"
                  disabled={!recap.trackIds.length}
                  onClick={() => void act(() => api.play(recap.trackIds))}
                >
                  <Play size={18} />
                  {t.playYear}
                </button>
                <button
                  className="button secondary"
                  disabled={!recap.listenedMs || recapLoading}
                  onClick={() => {
                    setModal(null);
                    setShareRecap(recap);
                  }}
                >
                  <Share2 size={18} />
                  {t.shareCard}
                </button>
              </>
            )}
          </div>
          <div className="story-controls">
            <IconButton
              label={t.previous}
              disabled={!story}
              onClick={() => setStory(story - 1)}
            >
              <ArrowLeft />
            </IconButton>
            <span>
              {story + 1} {t.of} 6
            </span>
            {story < 5 ? (
              <IconButton label={t.next} onClick={() => setStory(story + 1)}>
                <ArrowRight />
              </IconButton>
            ) : (
              <button className="text-button" onClick={() => setModal(null)}>
                {t.done}
              </button>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
