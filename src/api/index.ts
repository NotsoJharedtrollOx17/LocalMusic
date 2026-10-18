import { isTauri, invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type {
  MusicApi,
  PlaybackSnapshot,
  LibraryPage,
  Playlist,
  Settings,
  Recap,
  PlaylistRequest,
} from "../types";
import { BrowserMusic } from "./browser";
import { PlaybackUpdates } from "./PlaybackUpdates";
export const native = isTauri();
const cmd = <T>(name: string, args?: Record<string, unknown>) =>
  invoke<T>(name, args);
class NativeMusic implements MusicApi {
  private playbackUpdates = new PlaybackUpdates();
  searchCatalog(query: string, limit = 30) {
    return cmd<import("../types").SearchResults>("search_catalog", {
      query,
      limit,
    });
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
  personalAction(action: import("../sound/types").PersonalAction) {
    return cmd<import("../sound/types").PersonalSession>("personal_action", {
      action,
    });
  }
  openSoundPanel() {
    return cmd<void>("open_sound_panel");
  }
  groupIds(kind: "albums" | "artists", title: string, subtitle: string) {
    return cmd<string[]>("group_ids", { kind, title, subtitle });
  }
  groups(kind: "albums" | "artists", offset = 0) {
    return cmd<{ groups: import("../types").CatalogGroup[]; total: number }>(
      "list_groups",
      { kind, offset },
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
    return cmd<Playlist>("generate_playlist", { request });
  }
  settings() {
    return cmd<Settings>("get_settings", {
      defaultTimeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    });
  }
  saveSettings(settings: Settings) {
    return cmd<void>("save_settings", { settings });
  }
  recap(year: number) {
    return cmd<Recap>("get_recap", { year });
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
    return cmd<void>("play_queue", { ids, index: index ?? null });
  }
  toggle() {
    return cmd<void>("toggle_playback");
  }
  seek(ms: number) {
    return this.playbackUpdates.seek(
      () => cmd<void>("seek", { ms }),
      () => this.playback(),
    );
  }
  next() {
    return cmd<void>("next_track");
  }
  previous() {
    return cmd<void>("previous_track");
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
