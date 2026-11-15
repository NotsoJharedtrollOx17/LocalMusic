import { isTauri, invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type {
  MusicApi,
  PlaybackSnapshot,
  LibraryPage,
  Playlist,
  Settings,
  Recap,
  RecapRequest,
  PlaylistRequest,
} from "../types";
import { BrowserMusic } from "./browser";
import { PlaybackUpdates } from "./PlaybackUpdates";
export const native = isTauri();
const domains: Record<string, string> = {
  organize_library: "catalog",
  apply_playlist_cleanup: "playlists",
  set_favorite: "catalog",
  set_library_visibility: "catalog",
  import_music: "catalog",
  save_playlist: "playlists",
  delete_playlist: "playlists",
  set_suggestion_feedback: "feedback",
  set_excluded: "privacy",
  delete_history: "privacy",
  save_settings: "settings",
  set_sound: "sound",
  sound_action: "sound",
};
const cmd = async <T>(
  name: string,
  args?: Record<string, unknown>,
): Promise<T> => {
  const result = await invoke<T>(name, args);
  if (domains[name] && /Windows/i.test(navigator.userAgent))
    await invoke("desktop_changed", {
      domain: domains[name],
      ids:
        typeof args?.id === "string"
          ? [args.id]
          : Array.isArray(args?.ids)
            ? args.ids
            : [],
    }).catch(() => {});
  return result;
};
class NativeMusic implements MusicApi {
  organization() {
    return cmd<import("../library/identity").OrganizationSnapshot>(
      "library_organization",
    );
  }
  organize(
    revision: number,
    action: import("../library/identity").OrganizationAction,
  ) {
    return cmd<import("../library/identity").Organization>("organize_library", {
      revision,
      action,
    });
  }
  playlistCleanup(id: string) {
    return cmd<import("../library/identity").CleanupPreview>(
      "playlist_cleanup",
      { id },
    );
  }
  applyPlaylistCleanup(
    preview: import("../library/identity").CleanupPreview,
    undo: boolean,
  ) {
    return cmd<void>("apply_playlist_cleanup", { preview, undo });
  }
  playlistContext() {
    return cmd<import("../playlists/types").PlaylistContext>(
      "playlist_context",
    );
  }
  setSuggestionFeedback(id: string, less: boolean) {
    return cmd<void>("set_suggestion_feedback", { id, less });
  }
  analysisActivity(active: boolean) {
    return cmd<void>("analysis_activity", { active });
  }
  analyzeNext() {
    return cmd<void>("analyze_next");
  }
  startVisualizer() {
    return cmd<import("../visualizer/types").VisualizerSession>(
      "start_visualizer",
    );
  }
  readVisualizer(id: string) {
    return cmd<import("../visualizer/types").VisualizerFrame | null>(
      "read_visualizer",
      { id },
    );
  }
  stopVisualizer(id: string) {
    return cmd<void>("stop_visualizer", { id });
  }
  private playbackUpdates = new PlaybackUpdates();
  filterTrackIds(ids: string[], query: string) {
    return cmd<string[]>("filter_track_ids", { ids, query });
  }
  setLibraryVisibility(ids: string[], visible: boolean) {
    return cmd<void>("set_library_visibility", { ids, visible });
  }
  shareAudio(ids: string[]) {
    return cmd<import("../types").ShareOutcome>("share_audio", { ids });
  }
  soundCapabilities() {
    return cmd<import("../types").SoundCapabilities>("sound_capabilities");
  }
  setSound(config: import("../sound/types").SoundConfig) {
    return cmd<import("../sound/types").SoundState>("set_sound", { config });
  }
  soundAction(action: import("../sound/types").SoundAction) {
    return cmd<import("../sound/types").SoundState>("sound_action", { action });
  }
  groupIds(
    kind: "albums" | "artists",
    title: string,
    subtitle: string,
    id?: string,
  ) {
    return cmd<string[]>("group_ids", { kind, title, subtitle, id });
  }
  groups(kind: "albums" | "artists", offset = 0, query = "") {
    return cmd<{ groups: import("../types").CatalogGroup[]; total: number }>(
      "list_groups",
      { kind, offset, query },
    );
  }
  cover(id: string, size = 512) {
    return cmd<string>("resolve_cover", { id, size });
  }
  tracksById(ids: string[]) {
    return cmd<import("../types").Track[]>("tracks_by_id", { ids });
  }
  listTracks(
    query = "",
    offset = 0,
    limit = 60,
    options: import("../types").LibraryOptions = {},
  ) {
    return cmd<LibraryPage>("list_tracks", {
      query,
      offset,
      limit,
      favoriteOnly: options.favoriteOnly ?? false,
      sort: options.sort ?? "title",
    });
  }
  async importMusic(
    _files?: File[],
    mode = "library",
    onProgress?: (progress: import("../types").ImportProgress) => void,
  ) {
    const unlisten = await listen<import("../types").ImportProgress>(
      "catalog://progress",
      (event) => onProgress?.(event.payload),
    );
    try {
      return await cmd<number>("import_music", { mode });
    } finally {
      unlisten();
    }
  }
  cancelImport() {
    return cmd<void>("cancel_import");
  }
  addSamples() {
    return Promise.reject(
      new Error(
        "Sample audio is available in the browser preview. Import local music here.",
      ),
    );
  }
  setFavorite(id: string, favorite: boolean) {
    return cmd<void>("set_favorite", { id, favorite });
  }
  automaticPlaylists() {
    return cmd<Playlist[]>("automatic_playlists");
  }
  playlists() {
    return cmd<Playlist[]>("list_playlists");
  }
  savePlaylist(playlist: Playlist) {
    return cmd<void>("save_playlist", { playlist });
  }
  deletePlaylist(id: string) {
    return cmd<void>("delete_playlist", { id });
  }
  generatePlaylist(request: PlaylistRequest) {
    return cmd<import("../playlists/types").GeneratedMix>("generate_playlist", {
      request,
    });
  }
  settings() {
    return cmd<Settings>("get_settings", {
      defaultTimeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    });
  }
  saveSettings(settings: Settings) {
    return cmd<void>("save_settings", { settings });
  }
  recap(request: RecapRequest) {
    return cmd<Recap>("get_recap", { request });
  }
  saveSnapshot(recap: Recap) {
    return cmd<void>("save_snapshot", { recap });
  }
  snapshots() {
    return cmd<Recap[]>("list_snapshots");
  }
  deleteHistory() {
    return cmd<void>("delete_history");
  }
  playback() {
    return cmd<PlaybackSnapshot>("playback_snapshot");
  }
  async subscribe(cb: (s: PlaybackSnapshot) => void) {
    const unlisten = await listen<PlaybackSnapshot>(
      "playback://snapshot",
      (e) => this.playbackUpdates.push(e.payload),
    );
    const remove = this.playbackUpdates.add(cb);
    try {
      await this.playbackUpdates.poll(() => this.playback());
    } catch (error) {
      remove();
      unlisten();
      throw error;
    }
    let inFlight = false;
    const tick = () => {
      if (document.hidden || inFlight) return;
      inFlight = true;
      void this.playbackUpdates
        .poll(() => this.playback())
        .catch(() => {
          /* Keep the latest known snapshot on transient polling failures. */
        })
        .finally(() => {
          inFlight = false;
        });
    };
    const interval = setInterval(tick, 1000);
    document.addEventListener("visibilitychange", tick);
    return () => {
      unlisten();
      remove();
      clearInterval(interval);
      document.removeEventListener("visibilitychange", tick);
    };
  }
  play(ids: string[], index?: number) {
    return this.playbackUpdates.seek(
      () => cmd<void>("play_queue", { ids, index: index ?? null }),
      () => this.playback(),
    );
  }
  toggle() {
    return this.playbackUpdates.seek(
      () => cmd<void>("toggle_playback"),
      () => this.playback(),
    );
  }
  seek(ms: number) {
    return this.playbackUpdates.seek(
      () => cmd<void>("seek", { ms }),
      () => this.playback(),
    );
  }
  next() {
    return this.playbackUpdates.seek(() => cmd<void>("next_track"), () => this.playback());
  }
  previous() {
    return this.playbackUpdates.seek(() => cmd<void>("previous_track"), () => this.playback());
  }
  setShuffle(value: boolean) {
    return cmd<void>("set_shuffle", { value });
  }
  setRepeat(value: PlaybackSnapshot["repeat"]) {
    return cmd<void>("set_repeat", { value });
  }
  setExcluded(value: boolean) {
    return cmd<void>("set_excluded", { value });
  }
  reorderQueue(ids: string[]) {
    return cmd<void>("reorder_queue", { ids });
  }
}
export const api: MusicApi = native ? new NativeMusic() : new BrowserMusic();
