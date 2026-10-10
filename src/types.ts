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
  kind: "manual" | "generated" | "recap";
  trackIds: string[];
}
export interface PlaybackSnapshot {
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
export interface Settings {
  language: "en" | "es";
  theme: "system" | "light" | "dark";
  timeZone: string;
  historyEnabledSince: string;
  privacyRevision?: number;
}
export interface PlaylistRequest {
  title: string;
  targetCount?: number;
  targetMinutes?: number;
  genre: string;
  includeArtist: string;
  excludeArtist: string;
  preferFavorites: boolean;
  avoidHeardToday: boolean;
}
export interface Recap {
  schemaVersion: number;
  privacyRevision?: number;
  year: number;
  timeZone: string;
  coveredFrom: string;
  coveredThrough: string;
  completeYear: boolean;
  listenedMs: number;
  qualifiedPlays: number;
  activeDays: number;
  months: number[];
  topTracks: { track: Track; plays: number; playedMs: number }[];
  topArtist?: { name: string; plays: number };
  topAlbum?: { name: string; artist: string; plays: number };
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
export interface SearchResults {
  hasMore: boolean;
  tracks: Track[];
  albums: CatalogGroup[];
  artists: CatalogGroup[];
  playlists: Playlist[];
}
export interface SoundCapabilities {
  equalizer: boolean;
  systemPanel: boolean;
  enabled: boolean;
  preset: number;
  presets: string[];
}
export type ShareOutcome = "opened" | "saved" | "download" | "canceled";
export interface MusicApi {
  searchCatalog(query: string, limit?: number): Promise<SearchResults>;
  setLibraryVisibility(ids: string[], visible: boolean): Promise<void>;
  shareAudio(ids: string[]): Promise<ShareOutcome>;
  soundCapabilities(): Promise<SoundCapabilities>;
  setEqualizer(enabled: boolean, preset: number): Promise<void>;
  openSoundPanel(): Promise<void>;
  groupIds(
    kind: "albums" | "artists",
    title: string,
    subtitle: string,
  ): Promise<string[]>;
  groups(
    kind: "albums" | "artists",
    offset?: number,
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
  playlists(): Promise<Playlist[]>;
  savePlaylist(playlist: Playlist): Promise<void>;
  deletePlaylist(id: string): Promise<void>;
  generatePlaylist(request: PlaylistRequest): Promise<Playlist>;
  settings(): Promise<Settings>;
  saveSettings(settings: Settings): Promise<void>;
  recap(year: number): Promise<Recap>;
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
