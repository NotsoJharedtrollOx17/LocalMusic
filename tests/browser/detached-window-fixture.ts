import type { BrowserContext, Page } from "@playwright/test";
import { defaultSound } from "../../src/sound/model";
import type { WindowEntry } from "../../src/desktop/windows";
/** Deterministic IPC/lifecycle simulation; native acceptance is exercised separately. */
export class DetachedFixture {
  dismissed = new Set<string>();
  sound = {
    config: defaultSound(),
    supported: true,
    status: "ready",
    sampleRate: 48000,
    channels: 2,
    attenuation: 0,
    bypass: false,
    inactiveBands: [],
    routeMonitoring: true,
  };
  windows: WindowEntry[] = [];
  children = new Map<string, Page>();
  listeners = new Map<Page, Array<{ event: string; handler: number }>>();
  calls: string[] = [];
  serial = 0;
  failOpen = false;
  nativeMenu = false;
  menuFailure = false;
  playbackFailure = false;
  menuStates: any[] = [];
  about?: Page;
  soundWriteDelay = 0;
  settings = {
    language: "en",
    theme: "light",
    timeZone: "America/Los_Angeles",
    historyEnabledSince: "2026-10-01T00:00:00Z",
    privacyRevision: 0,
  };
  tracks = [
    {
      id: "one",
      title: "Window song",
      artist: "Window artist",
      album: "Window album",
      genre: "",
      durationMs: 120000,
      sourceUri: "fixture",
      favorite: false,
      available: true,
      demo: false,
      artworkUrl:
        'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"/>',
    },
  ];
  player = {
    revision: 1,
    trackId: "one",
    playing: false,
    positionMs: 1000,
    durationMs: 120000,
    queue: ["one"],
    queueIndex: 0,
    shuffle: false,
    repeat: "off",
    excluded: false,
  };
  constructor(private context: BrowserContext) {}
  async emit(event: string, payload: unknown) {
    for (const [page, list] of this.listeners) {
      if (page.isClosed()) continue;
      for (const item of list.filter((x) => x.event === event))
        await page
          .evaluate(
            ({ handler, event, payload }) => {
              (window as any).__callbacks[handler]?.({
                event,
                id: handler,
                payload,
              });
            },
            { handler: item.handler, event, payload },
          )
          .catch(() => {});
    }
  }
  async attach(page: Page, label = "main") {
    this.listeners.set(page, []);
    await page.exposeBinding(
      "__detachedInvoke",
      async (_, command: string, args: any = {}) => {
        this.calls.push(`${label}:${command}`);
        if (command === "plugin:event|listen") {
          this.listeners
            .get(page)!
            .push({ event: args.event, handler: args.handler });
          return args.handler;
        }
        if (command === "plugin:event|unlisten") {
          this.listeners.set(
            page,
            this.listeners.get(page)!.filter((e) => e.handler !== args.eventId),
          );
          return;
        }
        if (command === "desktop_state")
          return { supported: true, windows: this.windows };
        if (command === "plugin:app|version") return "0.18.1";
        if (command === "desktop_about") {
          if (args.op === "open") {
            if (label !== "main") throw Error("Only main opens About");
            if (this.about && !this.about.isClosed()) return;
            this.about = await this.context.newPage();
            await this.attach(this.about, "about");
            await this.about.goto("/?about=1");
          } else if (args.op === "close") {
            if (label !== "about") throw Error("Only About closes itself");
            setTimeout(() => void page.close(), 50);
          }
          return;
        }
        if (command === "desktop_menu_sync") {
          if (!this.nativeMenu) return null;
          if (label !== "main") throw Error("Only main owns the menu");
          if (this.menuFailure) throw Error("Simulated native menu failure");
          this.menuStates.push(args.state);
          return { supported: true, ready: true, version: "0.18.1" };
        }
        if (command === "get_settings") return this.settings;
        if (command === "patch_settings") {
          this.settings = { ...this.settings, ...args.patch };
          await this.emit("desktop://changed", {
            domain: "settings",
            revision: ++this.serial,
          });
          return this.settings;
        }
        if (command === "desktop_changed") {
          await this.emit("desktop://changed", {
            domain: args.domain,
            revision: ++this.serial,
          });
          return;
        }
        if (command === "sound_capabilities") return this.sound;
        if (command === "set_sound") {
          if (this.soundWriteDelay)
            await new Promise((r) => setTimeout(r, this.soundWriteDelay));
          this.sound.config = args.config;
          await this.emit("desktop://changed", {
            domain: "sound",
            revision: ++this.serial,
            source: label,
          });
          return this.sound;
        }
        if (command === "sound_action") {
          if (args.action.op === "bypass")
            this.sound.bypass = args.action.value;
          return this.sound;
        }
        if (command === "playback_snapshot") return this.player;
        if (command === "list_tracks")
          return { tracks: this.tracks, total: this.tracks.length };
        if (command === "tracks_by_id")
          return this.tracks.filter((t) => args.ids.includes(t.id));
        if (command === "list_groups") return { groups: [], total: 0 };
        if (command === "list_playlists" || command === "automatic_playlists")
          return [];
        if (command === "playlist_context")
          return {
            artists: [],
            genres: [],
            less: [],
            analyzed: 0,
            total: 1,
            scanning: false,
          };
        if (command === "resolve_cover") return this.tracks[0].artworkUrl;
        if (command === "set_favorite") {
          this.tracks[0].favorite = args.favorite;
          return;
        }
        if (command === "toggle_playback") {
          this.player = {
            ...this.player,
            playing: !this.player.playing,
            revision: this.player.revision + 1,
          };
          await this.emit("playback://snapshot", this.player);
          return;
        }
        if (command === "set_shuffle" || command === "set_repeat") {
          if (this.playbackFailure)
            throw Error("Simulated playback command failure");
          this.player = {
            ...this.player,
            revision: this.player.revision + 1,
            ...(command === "set_shuffle"
              ? { shuffle: args.value }
              : { repeat: args.value }),
          };
          await this.emit("playback://snapshot", this.player);
          return;
        }
        if (command === "seek") {
          this.player = {
            ...this.player,
            positionMs: args.ms,
            revision: this.player.revision + 1,
          };
          await this.emit("playback://snapshot", this.player);
          return;
        }
        if (command === "desktop_action") {
          const a = args.action,
            entry = this.windows.find((e) => e.view === a.view);
          if (a.op === "navigate") {
            await this.emit("desktop://navigate", {
              kind: a.kind,
              trackId: a.trackId,
            });
            return;
          }
          if (a.op === "open") {
            if (this.failOpen) throw Error("Simulated window creation failure");
            if (entry) {
              if (a.view === "player") {
                entry.queue = a.queue;
                await this.emit("desktop://windows", this.windows);
              }
              return;
            }
            this.windows.push({
              view: a.view,
              phase: "opening",
              generation: ++this.serial,
              queue: a.queue,
              pinned: false,
            });
            await this.emit("desktop://windows", this.windows);
            const child = await this.context.newPage();
            this.children.set(a.view, child);
            await this.attach(child, a.view);
            await child.goto(`/?companion=${a.view}`);
            return;
          }
          if (a.op === "ready" && entry) {
            entry.phase = "transferring";
            await this.emit("desktop://windows", this.windows);
            return;
          }
          if (a.op === "released" && entry) {
            if (entry.phase === "transferring") {
              entry.phase = "detached";
              await this.emit("desktop://windows", this.windows);
            } else if (entry.phase === "returning") {
              this.windows = this.windows.filter((e) => e !== entry);
              await this.emit("desktop://windows", this.windows);
              if (!this.dismissed.has(entry.view))
                await this.emit("desktop://returned", entry);
              this.dismissed.delete(entry.view);
              setTimeout(() => void page.close(), 50);
            }
            return;
          }
          if ((a.op === "return" || a.op === "dismiss") && entry) {
            if (a.op === "dismiss") this.dismissed.add(entry.view);
            entry.phase = "returning";
            await this.emit("desktop://windows", this.windows);
            return;
          }
          if (a.op === "pin" && entry) {
            entry.pinned = a.value;
            await this.emit("desktop://windows", this.windows);
            return;
          }
          if (a.op === "queue") {
            const e = this.windows.find((e) => e.view === "player");
            if (e) e.queue = a.value;
            await this.emit("desktop://windows", this.windows);
            return;
          }
          return;
        }
        if (command === "start_visualizer")
          return {
            id: "fixture",
            capabilities: {
              fftSize: 2048,
              bands: 64,
              waveformPoints: 256,
              maxUpdatesPerSecond: 30,
              postEffects: true,
            },
          };
        if (command === "read_visualizer") return null;
        return null;
      },
    );
    await page.addInitScript((label) => {
      const w = window as any;
      w.isTauri = true;
      w.__callbacks = {};
      let id = 0;
      w.__TAURI_EVENT_PLUGIN_INTERNALS__ = { unregisterListener: () => {} };
      w.__TAURI_INTERNALS__ = {
        metadata: { currentWindow: { label }, currentWebview: { label } },
        transformCallback: (fn: unknown) => {
          w.__callbacks[++id] = fn;
          return id;
        },
        invoke: (command: string, args: unknown) =>
          w.__detachedInvoke(command, args),
      };
    }, label);
  }
}
