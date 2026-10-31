export interface Track {
  id: string;
  title: string;
  artist: string;
  album: string;
  releaseYear?: number | null;
  releaseMetadataRead?: boolean;
  genre: string;
  trackNumber?: number | null;
  discNumber?: number | null;
  orderMetadataRead?: boolean;
  durationMs: number;
  artworkUrl?: string;
  sourceUri: string;
  favorite: boolean;
  available: boolean;
  demo?: boolean;
  hidden?: boolean;
}
export interface Playlist {
  id: string;
  title: string;
  kind: "manual" | "generated" | "recap" | "automatic";
  trackIds: string[];
}
export interface PlaybackSnapshot {
  revision?: number;
  trackId: string | null;
  playing: boolean;
  positionMs: number;
  durationMs: number;
  queue: string[];
  queueIndex: number;
  shuffle: boolean;
  repeat: "off" | "all" | "one";
  excluded: boolean;
  error?: string;
}
export interface Interval {
  sessionId: string;
  sequence: number;
  startUtc: string;
  playedMs: number;
}
export interface Session {
  id: string;
  trackId: string;
  startedAtUtc: string;
  playedMs: number;
  excluded: boolean;
  endReason?: string;
}
export type RecapKind = "week" | "month" | "year";
export interface RecapRequest {
  kind: RecapKind;
  anchorDate: string;
}
export interface RecapPeriod {
  kind: RecapKind;
  startDate: string;
  endDate: string;
}
export interface RecapBucket {
  startDate: string;
  endDate: string;
  listenedMs: number;
  observed: boolean;
}
export interface Settings {
  playlistBlend?: import("./playlists/types").PlaylistBlend;
  visualizerMode?: import("./visualizer/types").VisualizerMode;
  recapPeriod?: RecapKind;
  language: "en" | "es";
  theme: "system" | "light" | "dark";
  timeZone: string;
  historyEnabledSince: string;
  privacyRevision?: number;
}
export interface PlaylistRequest {
  blend?: import("./playlists/types").PlaylistBlend;
  seed?: number;
  title: string;
  targetCount?: number;
  targetMinutes?: number;
  genre: string;
  includeArtist: string;
  excludeArtist: string;
  includeArtists?: string[];
  excludeArtists?: string[];
  preferFavorites: boolean;
  avoidHeardToday: boolean;
}
export interface Recap {
  schemaVersion: number;
  privacyRevision?: number;
  period: RecapPeriod;
  timeZone: string;
  coveredFrom: string;
  coveredThrough: string;
  completePeriod: boolean;
  listenedMs: number;
  qualifiedPlays: number;
  activeDays: number;
  buckets: RecapBucket[];
  topTracks: { track: Track; plays: number; playedMs: number }[];
  topArtists?: { name: string; plays: number }[];
  topAlbums?: {
    name: string;
    artist: string;
    plays: number;
    trackId?: string;
  }[];
  topArtist?: { name: string; plays: number };
  topAlbum?: { name: string; artist: string; plays: number; trackId?: string };
  trackIds: string[];
  visualSeed: string;
}
export interface LibraryPage {
  tracks: Track[];
  total: number;
}
export interface CatalogGroup {
  title: string;
  subtitle: string;
  ids: string[];
  track: Track;
}
export interface LibraryOptions {
  favoriteOnly?: boolean;
  sort?: "title" | "artist" | "album";
}
export interface ImportProgress {
  imported: number;
  failed: number;
}
export type SoundCapabilities = import("./sound/types").SoundState;
export type ShareOutcome = "opened" | "saved" | "download" | "canceled";
export interface MusicApi {
  playlistContext(): Promise<import("./playlists/types").PlaylistContext>;
  setSuggestionFeedback(id: string, less: boolean): Promise<void>;
  analysisActivity(active: boolean): Promise<void>;
  analyzeNext(): Promise<void>;
  startVisualizer(): Promise<import("./visualizer/types").VisualizerSession>;
  readVisualizer(
    id: string,
  ): Promise<import("./visualizer/types").VisualizerFrame | null>;
  stopVisualizer(id: string): Promise<void>;
  filterTrackIds(ids: string[], query: string): Promise<string[]>;
  setLibraryVisibility(ids: string[], visible: boolean): Promise<void>;
  shareAudio(ids: string[]): Promise<ShareOutcome>;
  soundCapabilities(): Promise<SoundCapabilities>;
  setSound(
    config: import("./sound/types").SoundConfig,
  ): Promise<SoundCapabilities>;
  soundAction(
    action: import("./sound/types").SoundAction,
  ): Promise<SoundCapabilities>;
  groupIds(
    kind: "albums" | "artists",
    title: string,
    subtitle: string,
  ): Promise<string[]>;
  groups(
    kind: "albums" | "artists",
    offset?: number,
    query?: string,
  ): Promise<{ groups: CatalogGroup[]; total: number }>;
  cover(id: string, size?: number): Promise<string>;
  tracksById(ids: string[]): Promise<Track[]>;
  listTracks(
    query?: string,
    offset?: number,
    limit?: number,
    options?: LibraryOptions,
  ): Promise<LibraryPage>;
  importMusic(
    files?: File[],
    mode?: "library" | "folder",
    onProgress?: (progress: ImportProgress) => void,
  ): Promise<number>;
  cancelImport(): Promise<void>;
  addSamples(): Promise<number>;
  setFavorite(id: string, favorite: boolean): Promise<void>;
  automaticPlaylists(): Promise<Playlist[]>;
  playlists(): Promise<Playlist[]>;
  savePlaylist(playlist: Playlist): Promise<void>;
  deletePlaylist(id: string): Promise<void>;
  generatePlaylist(
    request: PlaylistRequest,
  ): Promise<import("./playlists/types").GeneratedMix>;
  settings(): Promise<Settings>;
  saveSettings(settings: Settings): Promise<void>;
  recap(request: RecapRequest): Promise<Recap>;
  saveSnapshot(recap: Recap): Promise<void>;
  snapshots(): Promise<Recap[]>;
  deleteHistory(): Promise<void>;
  playback(): Promise<PlaybackSnapshot>;
  subscribe(callback: (state: PlaybackSnapshot) => void): Promise<() => void>;
  play(ids: string[], index?: number): Promise<void>;
  toggle(): Promise<void>;
  seek(ms: number): Promise<void>;
  next(): Promise<void>;
  previous(): Promise<void>;
  setShuffle(value: boolean): Promise<void>;
  setRepeat(value: PlaybackSnapshot["repeat"]): Promise<void>;
  setExcluded(value: boolean): Promise<void>;
  reorderQueue(ids: string[]): Promise<void>;
}
