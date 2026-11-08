import { periodFor, localDate } from "../recap/periods";
import { useState, useRef } from "react";

import {
  type Track,
  type Playlist,
  type PlaylistRequest,
  type PlaybackSnapshot,
  type Settings,
  type Recap,
  type RecapRequest,
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
  loaded?: boolean;
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
      id?: string;
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
    [generated, setGenerated] = useState<
      import("../playlists/types").GeneratedMix | null
    >(null),
    [recap, setRecap] = useState<Recap>(),
    [shareRecap, setShareRecap] = useState<Recap | null>(null),
    [recapLoading, setRecapLoading] = useState(false),
    [recapError, setRecapError] = useState(""),
    [recapRevision, setRecapRevision] = useState(0),
    [snapshotMode, setSnapshotMode] = useState(false),
    [snapshots, setSnapshots] = useState<Recap[]>([]),
    [recapSelection, setRecapSelection] = useState<RecapRequest>({
      kind: initialSettings?.recapPeriod ?? "year",
      anchorDate: periodFor({
        kind: initialSettings?.recapPeriod ?? "year",
        anchorDate: localDate(
          new Date(),
          initialSettings?.timeZone ??
            Intl.DateTimeFormat().resolvedOptions().timeZone,
        ),
      }).startDate,
    }),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState(""),
    [error, setError] = useState("");
  const [organizationTab, setOrganizationTab] = useState<
    "artists" | "songs" | "albums"
  >("artists");
  const [modal, setModal] = useState<
      | "settings"
      | "organize"
      | "player"
      | "queue"
      | "manual"
      | "track"
      | "snapshots"
      | "story"
      | "remove"
      | "add"
      | "visualizer"
      | "equalizer"
      | "help"
      | "about"
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
  const [savingPlaylistId, setSavingPlaylistId] = useState<string | null>(null);
  const [playerParent, setPlayerParent] = useState<"player" | "queue" | null>(
    null,
  );
  const [miniHidden, setMiniHidden] = useState(false);
  const [request, setRequest] = useState<PlaylistRequest>({
      blend: initialSettings?.playlistBlend ?? "balanced",
      title: "",
      targetCount: 30,
      genre: "",
      includeArtist: "",
      excludeArtist: "",
      includeArtists: [],
      excludeArtists: [],
      preferFavorites: false,
      avoidHeardToday: false,
    }),
    [target, setTarget] = useState(30);
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
  const playlistOrigin = useRef<{ scroll: number; id: string } | null>(null);
  const groupScroll = useRef(0),
    lastSelected = useRef<string | undefined>(undefined),
    miniDrag = useRef<number | null>(null);
  const groupStack = useRef<
    Array<{
      group: NonNullable<typeof group>;
      scroll: number;
      selector?: string;
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
    savingPlaylistId,
    setSavingPlaylistId,
    organizationTab,
    setOrganizationTab,
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
    recapError,
    setRecapError,
    recapRevision,
    setRecapRevision,
    snapshotMode,
    setSnapshotMode,
    snapshots,
    setSnapshots,
    recapSelection,
    setRecapSelection,
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
    playlistOrigin,
    groupScroll,
    lastSelected,
    miniDrag,
    miniHidden,
    setMiniHidden,
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
