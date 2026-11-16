import type { Page } from "@playwright/test";

/** Delayed native IPC, without claiming native audio playback. */
export async function delayedPlayback(page: Page) {
  await page.addInitScript(() => {
    const fixture = window as any;
    fixture.isTauri = true;
    fixture.position = 10000;
    const cover =
      'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"/>';
    const track = {
      id: "fixture",
      title: "Test track",
      artist: "Artist",
      album: "Album",
      genre: "",
      durationMs: 40000,
      sourceUri: "fixture",
      favorite: false,
      available: true,
      artworkUrl: cover,
    };
    const snapshot = () => ({
      trackId: track.id,
      playing: false,
      positionMs: fixture.position,
      durationMs: 40000,
      queue: [track.id],
      queueIndex: 0,
      shuffle: false,
      repeat: "off",
      excluded: false,
    });
    fixture.__TAURI_EVENT_PLUGIN_INTERNALS__ = { unregisterListener: () => {} };
    fixture.__TAURI_INTERNALS__ = {
      transformCallback: () => 1,
      invoke: async (command: string, args: any) => {
        if (command === "get_settings")
          return {
            language: "en",
            theme: "light",
            timeZone: "America/Los_Angeles",
            historyEnabledSince: "2026-10-01T00:00:00Z",
            privacyRevision: 0,
          };
        if (command === "playlist_context")
          return {
            artists: ["Artist"],
            genres: [],
            less: [],
            analyzed: 0,
            total: 1,
            scanning: false,
          };
        if (command === "catalog_index") return { revision: 0, tracks: [track], albums: [], artists: [] };
        if (command === "list_tracks") return { tracks: [track], total: 1 };
        if (command === "tracks_by_id") return [track];
        if (command === "resolve_cover") return cover;
        if (command === "list_playlists") return [];
        if (command === "plugin:event|listen") return 1;
        if (command === "seek") {
          fixture.seekHeld = true;
          await new Promise<void>((resolve) => {
            fixture.releaseSeek = () => {
              fixture.position = args.ms;
              resolve();
            };
          });
          return;
        }
        if (command === "playback_snapshot") {
          const value = snapshot();
          if (fixture.holdPoll) {
            fixture.holdPoll = false;
            fixture.pollHeld = true;
            return new Promise((resolve) => {
              fixture.releasePoll = () => resolve(value);
            });
          }
          if (fixture.holdFresh) {
            fixture.holdFresh = false;
            fixture.freshHeld = true;
            return new Promise((resolve) => {
              fixture.releaseFresh = () => resolve(value);
            });
          }
          return value;
        }
        return null;
      },
    };
  });
}
