import { useState, useRef } from "react";

import {
  type Track,
  type Playlist,
  type PlaylistRequest,
  type PlaybackSnapshot,
  type Settings,
  type Recap,
  type CatalogGroup,
  type ImportProgress,
} from "../types";

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
type GroupPage = {
  groups: CatalogGroup[];
  total: number;
  status: "idle" | "loading" | "ready" | "error";
};

export function useAppState(initialSettings?: Settings) {
  const [section, setSection] = useState<
      "songs" | "albums" | "artists" | "playlists" | "year"
    >("songs"),
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
      coverTrack: Track;
    } | null>(null);
  const [groupTracks, setGroupTracks] = useState<Track[]>([]),
    [groupLoading, setGroupLoading] = useState(false);
  const [groupPages, setGroupPages] = useState<
    Record<"albums" | "artists", GroupPage>
  >({
    albums: { groups: [], total: 0, status: "idle" },
    artists: { groups: [], total: 0, status: "idle" },
  });
  const [libraryLoading, setLibraryLoading] = useState(true);
  const [queueLimit, setQueueLimit] = useState(60);
  const [settings, setSettings] = useState<Settings | undefined>(
      initialSettings,
    ),
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
      | "remove"
      | "add"
      | "sound"
      | "equalizer"
      | "adapt"
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
  const [playerParent, setPlayerParent] = useState<"player" | "queue" | null>(
    null,
  );
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
  const [sharing, setSharing] = useState(false);
  const [catalogRevision, setCatalogRevision] = useState(0);
  const [selectedIds, setSelectedIds] = useState<string[]>([]),
    [selectionMode, setSelectionMode] = useState(false);
  const [actionIds, setActionIds] = useState<string[]>([]),
    [undoIds, setUndoIds] = useState<string[]>([]);
  const [menu, setMenu] = useState<{
    track: Track;
    anchor: HTMLElement;
    point?: { x: number; y: number };
  } | null>(null);
  const [artistView, setArtistView] = useState<"tracks" | "albums">("tracks"),
    [artistAlbums, setArtistAlbums] = useState<CatalogGroup[]>([]),
    [artistAlbumsLoading, setArtistAlbumsLoading] = useState(false);
  const coverOrigin = useRef<{ rect: DOMRect; src: string } | null>(null),
    detailHero = useRef<HTMLImageElement>(null);
  const groupScroll = useRef(0),
    lastSelected = useRef<string | undefined>(undefined),
    miniDrag = useRef<number | null>(null);
  const groupStack = useRef<
    Array<{
      group: NonNullable<typeof group>;
      scroll: number;
      artistView: "tracks" | "albums";
    }>
  >([]);
  const [chooserOpen, setChooserOpen] = useState(false);
  const [importProgress, setImportProgress] = useState<ImportProgress | null>(
    null,
  );
  const importActive = useRef(false);
  const latestQuery = useRef(query);
  const settingsWrite = useRef<Promise<void>>(Promise.resolve());
  const fileInput = useRef<HTMLInputElement>(null),
    folderInput = useRef<HTMLInputElement>(null),
    searchInput = useRef<HTMLInputElement>(null);
  return {
    playerParent,
    setPlayerParent,
    sharing,
    setSharing,
    section,
    setSection,
    tracks,
    setTracks,
    total,
    setTotal,
    cache,
    setCache,
    query,
    setQuery,
    searchOpen,
    setSearchOpen,
    onlyFavorites,
    setOnlyFavorites,
    sort,
    setSort,
    group,
    setGroup,
    groupTracks,
    setGroupTracks,
    groupLoading,
    setGroupLoading,
    groupPages,
    setGroupPages,
    libraryLoading,
    setLibraryLoading,
    queueLimit,
    setQueueLimit,
    settings,
    setSettings,
    player,
    setPlayer,
    lists,
    setLists,
    selectedList,
    setSelectedList,
    generated,
    setGenerated,
    recap,
    setRecap,
    shareRecap,
    setShareRecap,
    recapLoading,
    setRecapLoading,
    recapRevision,
    setRecapRevision,
    snapshotMode,
    setSnapshotMode,
    snapshots,
    setSnapshots,
    year,
    setYear,
    busy,
    setBusy,
    notice,
    setNotice,
    error,
    setError,
    modal,
    setModal,
    detail,
    setDetail,
    story,
    setStory,
    pickerTracks,
    setPickerTracks,
    pickerTotal,
    setPickerTotal,
    pickerQuery,
    setPickerQuery,
    manualTitle,
    setManualTitle,
    manualIds,
    setManualIds,
    editingList,
    setEditingList,
    request,
    setRequest,
    targetMode,
    setTargetMode,
    target,
    setTarget,
    catalogRevision,
    setCatalogRevision,
    selectedIds,
    setSelectedIds,
    selectionMode,
    setSelectionMode,
    actionIds,
    setActionIds,
    undoIds,
    setUndoIds,
    menu,
    setMenu,
    artistView,
    setArtistView,
    artistAlbums,
    setArtistAlbums,
    artistAlbumsLoading,
    setArtistAlbumsLoading,
    coverOrigin,
    detailHero,
    groupScroll,
    lastSelected,
    miniDrag,
    groupStack,
    chooserOpen,
    setChooserOpen,
    importProgress,
    setImportProgress,
    importActive,
    latestQuery,
    settingsWrite,
    fileInput,
    folderInput,
    searchInput,
  };
}

export type MusicAppState = ReturnType<typeof useAppState>;
