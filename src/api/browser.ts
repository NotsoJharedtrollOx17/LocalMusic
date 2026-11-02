import {
  organize,
  emptyOrganization,
  applyOrganization,
  uniqueSongs,
  leadArtist,
  importedArtistNames,
  songIdentity,
  baseAlbumId,
  defaultAlbumId,
  albumArtist,
  artistId,
  normalized,
} from "../library/identity";
import organizationWorker from "../library/organization.worker.ts?worker&url";
import type {
  Organization,
  OrganizationAction,
  OrganizationSnapshot,
  CleanupPreview,
} from "../library/identity";
import { CatalogMatcher } from "../search/CatalogMatcher";
import { normalizeRecap } from "../recap/periods";
import { automaticPlaylists } from "../automaticPlaylists";
import { ensureImportOrder, putImportedTrack } from "./browserImportOrder";
import { BrowserSound } from "../sound/BrowserSound";
import { BrowserVisualizer } from "../visualizer/BrowserVisualizer";
import { analysisOrder, validFeature } from "../playlists/rank";
import { browserRanking } from "../playlists/browserRanking";
import {
  BrowserAnalysis,
  browserFingerprint,
} from "../playlists/BrowserAnalysis";
import type { AcousticFeature, RecommendationData } from "../playlists/types";
import type {
  MusicApi,
  Track,
  Session,
  Interval,
  Settings,
  Playlist,
  PlaylistRequest,
  PlaybackSnapshot,
  Recap,
  RecapRequest,
} from "../types";
import {
  aggregate,
  generate,
  coverUrl,
  compareAlbumTracks,
  compareCatalogTracks,
} from "../domain";
type StoredTrack = Track & {
  file: Blob;
  cover?: Blob;
  audioChannels?: number;
  importSequence?: number;
};
const validReleaseYear = (year: number | undefined) =>
  year && Number.isInteger(year) && year >= 1000 && year <= 9999
    ? year
    : undefined;
const initialPlayback = (): PlaybackSnapshot => ({
  trackId: null,
  playing: false,
  positionMs: 0,
  durationMs: 0,
  queue: [],
  queueIndex: 0,
  shuffle: false,
  repeat: "off",
  excluded: false,
});
export class BrowserMusic implements MusicApi {
  private catalogGeneration = 0;
  private storedCatalogRevision: number | undefined;
  private catalogCache?: Promise<{
    revision: number;
    tracks: Omit<StoredTrack, "file">[];
  }>;
  private catalogGroupsCache = new Map<
    string,
    import("../types").CatalogGroup[]
  >();
  private catalogMatcher = new CatalogMatcher();
  private invalidateCatalog() {
    this.catalogGeneration++;
    this.catalogCache = undefined;
    this.catalogGroupsCache.clear();
  }
  private async catalogSnapshot() {
    await this.ensureAlbumOrder();
    const revision = Number(
      (await this.get<number>("settings", "catalog-revision")) ?? 0,
    );
    if (revision !== this.storedCatalogRevision) {
      this.storedCatalogRevision = revision;
      this.invalidateCatalog();
    }
    return (this.catalogCache ??= (async () => {
      const revision = this.catalogGeneration;
      const tracks = (await this.all<StoredTrack>("tracks"))
        .filter((t) => !t.hidden)
        .map(({ file: _, ...track }) => track);
      return { revision, tracks };
    })().catch((error) => {
      this.catalogCache = undefined;
      throw error;
    }));
  }
  async filterTrackIds(ids: string[], query: string) {
    const snapshot = await this.catalogSnapshot();
    const matching = await this.catalogMatcher.match(
      snapshot.tracks,
      snapshot.revision,
      query,
    );
    return ids.filter((id) => matching.has(id));
  }
  private analysis = new BrowserAnalysis(
    () => !this.audio.paused || this.changing,
  );
  private recommendationRevision = 0;
  async analysisActivity(active: boolean) {
    this.analysis.activity(active);
  }
  private async recommendationSnapshot() {
    const db = await this.db;
    return new Promise<{
      tracks: StoredTrack[];
      sessions: Session[];
      settings: Settings | undefined;
      data: RecommendationData;
    }>((resolve, reject) => {
      const tx = db.transaction([
        "tracks",
        "sessions",
        "settings",
        "suggestionLess",
        "acousticFeatures",
        "organization",
      ]);
      const organization = tx.objectStore("organization").get("state");
      const tracks = tx.objectStore("tracks").getAll(),
        sessions = tx.objectStore("sessions").getAll(),
        settings = tx.objectStore("settings").get("preferences"),
        less = tx.objectStore("suggestionLess").getAllKeys(),
        features = tx.objectStore("acousticFeatures").getAll(),
        featureIds = tx.objectStore("acousticFeatures").getAllKeys();
      tx.oncomplete = () => {
        const byId = new Map<string, StoredTrack>(
          tracks.result.map((t: StoredTrack) => [t.id, t]),
        );
        resolve({
          tracks: (tracks.result as StoredTrack[]).map((t) =>
            organize(t, organization.result ?? emptyOrganization()),
          ),
          sessions: sessions.result,
          settings: settings.result,
          data: {
            less: less.result as string[],
            features: Object.fromEntries(
              features.result
                .map((f: AcousticFeature, i: number) => [
                  String(featureIds.result[i]),
                  f,
                ])
                .filter(([id, f]) => {
                  const t = byId.get(id as string);
                  return (
                    t &&
                    validFeature(f as AcousticFeature) &&
                    (f as AcousticFeature).fingerprint === browserFingerprint(t)
                  );
                }),
            ),
          },
        });
      };
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  }
  async playlistContext() {
    const { tracks, data } = await this.recommendationSnapshot();
    const pool = tracks.filter((t) => t.available && !t.hidden);
    return {
      artists: [
        ...new Set(pool.map((t) => leadArtist(t)).filter(Boolean)),
      ].sort(),
      genres: [
        ...new Set(
          pool
            .flatMap((t) => t.genre.split(/[;,/]/).map((s) => s.trim()))
            .filter(Boolean),
        ),
      ].sort(),
      less: data.less,
      analyzed: pool.filter((t) => !!data.features[t.id]).length,
      total: pool.length,
      scanning: this.analysis.busy,
    };
  }
  async setSuggestionFeedback(id: string, less: boolean) {
    if (!(await this.get("tracks", id))) throw new Error("Unknown track");
    if (less) await this.put("suggestionLess", id, true);
    else await this.remove("suggestionLess", id);
    this.recommendationRevision++;
  }
  async analyzeNext() {
    const { tracks, sessions, data } = await this.recommendationSnapshot();
    const next = analysisOrder(tracks, sessions).find(
      (t) =>
        !data.features[t.id] &&
        (this.analysis.failed.get(browserFingerprint(t)) ?? 0) <= Date.now(),
    );
    if (next)
      await this.analysis.analyze(next, async (f, active) => {
        const current = await this.get<StoredTrack>("tracks", next.id);
        if (
          active() &&
          current &&
          browserFingerprint(current) === f.fingerprint
        )
          await this.put("acousticFeatures", next.id, f);
      });
  }
  private db: Promise<IDBDatabase>;
  private audio = new Audio();
  private sound: BrowserSound;
  private visualizer?: BrowserVisualizer;
  async startVisualizer() {
    await this.sound.activate();
    this.visualizer ??= new BrowserVisualizer(this.audio, this.sound);
    return this.visualizer.start();
  }
  async readVisualizer(id: string) {
    return this.visualizer?.read(id) ?? null;
  }
  async stopVisualizer(id: string) {
    this.visualizer?.stop(id);
  }
  private state = initialPlayback();
  private listeners = new Set<(s: PlaybackSnapshot) => void>();
  private urls = new Map<string, string>();
  private artwork = new Map<string, string>();
  private session: Session | null = null;
  private sequence = 0;
  private startedMono: number | null = null;
  private startedPosition = 0;
  private startedUtc = "";
  private writes = Promise.resolve();
  private recent: number[] = [];
  private ready: Promise<void>;
  private changing = false;
  private privateMode = false;
  private cancelled = false;
  private orderReady?: Promise<void>;
  private identityAttempted = new Set<string>();
  private identityBusy = false;
  private identityQueue: string[] = [];
  private async backfillIdentity() {
    if (
      this.identityBusy ||
      !this.identityQueue.length ||
      document.hidden ||
      !this.audio.paused ||
      this.changing
    )
      return;
    this.identityBusy = true;
    try {
      const { parseBlob } = await import("music-metadata");
      let changed = false;
      for (let n = 0; n < 8 && this.identityQueue.length; n++) {
        if (document.hidden || !this.audio.paused || this.changing) break;
        const id = this.identityQueue.shift()!;
        if (this.identityAttempted.has(id)) continue;
        this.identityAttempted.add(id);
        try {
          const old = await this.rawGet<StoredTrack>("tracks", id);
          if (!old?.file || old.identityMetadataRead || old.demo) continue;
          const m = await parseBlob(old.file, {
            duration: false,
            skipCovers: true,
          });
          const current = await this.get<StoredTrack>("tracks", id);
          if (current && current.sourceUri === old.sourceUri) {
            const artistNames = importedArtistNames(
                m.common.artist ?? current.artist,
                m.common.artists,
              ),
              albumArtist = m.common.albumartist;
            const affectsIndex =
              JSON.stringify(current.artistNames ?? []) !==
                JSON.stringify(artistNames) ||
              normalized(current.albumArtist ?? "") !==
                normalized(albumArtist ?? "");
            await this.put("tracks", id, {
              ...current,
              artistNames,
              albumArtist,
              identityMetadataRead: true,
            });
            changed ||= affectsIndex;
          }
        } catch {
          /* Retry inaccessible sources on next launch. */
        }
      }
      if (changed)
        window.dispatchEvent(new Event("library-organization-changed"));
    } finally {
      this.identityBusy = false;
    }
  }
  constructor() {
    window.setInterval(
      () => void this.backfillIdentity().catch(() => {}),
      1500,
    );
    this.db = new Promise((resolve, reject) => {
      const r = indexedDB.open("local-music-v1", 3);
      r.onupgradeneeded = () => {
        for (const name of [
          "tracks",
          "sessions",
          "intervals",
          "playlists",
          "settings",
          "snapshots",
          "suggestionLess",
          "acousticFeatures",
          "organization",
        ])
          if (!r.result.objectStoreNames.contains(name))
            r.result.createObjectStore(name);
      };
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
    this.sound = new BrowserSound(
      this.audio,
      () =>
        this.get<import("../sound/types").SoundConfig>("settings", "sound-v1"),
      (config) => this.put("settings", "sound-v1", config),
    );
    this.ready = this.get<PlaybackSnapshot>("settings", "queue").then((v) => {
      if (v) {
        this.state = { ...v, playing: false, error: undefined };
        this.privateMode = !v.trackId?.startsWith("sample-") && v.excluded;
      }
    });
    this.audio.addEventListener("playing", () => {
      this.analysis.activity(false);
      if (!this.session && this.state.trackId) {
        this.session = {
          id: crypto.randomUUID(),
          trackId: this.state.trackId,
          startedAtUtc: new Date().toISOString(),
          playedMs: 0,
          excluded: this.state.excluded,
        };
        this.sequence = 0;
      }
      if (this.startedMono === null) {
        this.startedPosition = this.audio.currentTime;
        this.startedMono = performance.now();
        this.startedUtc = new Date().toISOString();
      }
      this.state.playing = true;
      this.state.error = undefined;
      this.emit();
    });
    this.audio.addEventListener("pause", () => {
      this.checkpoint();
      this.state.playing = false;
      this.emit();
    });
    this.audio.addEventListener("waiting", () => {
      this.checkpoint();
      this.state.playing = false;
      this.emit();
    });
    this.audio.addEventListener("timeupdate", () => {
      this.state.positionMs = this.audio.currentTime * 1000;
      this.emit(false);
    });
    this.audio.addEventListener("ended", () => {
      this.finish("completed");
      if (this.state.repeat === "one")
        void this.play(this.state.queue, this.state.queueIndex);
      else if (
        this.state.queueIndex + 1 < this.state.queue.length ||
        this.state.repeat === "all"
      )
        void this.next();
      else {
        this.state.playing = false;
        this.emit();
      }
    });
    this.audio.addEventListener("error", () => {
      this.finish("error");
      this.state.playing = false;
      this.state.error =
        "This file could not be played. Try another audio format.";
      this.emit();
    });
    setInterval(() => {
      this.checkpoint();
      if (
        !this.audio.paused &&
        !this.audio.ended &&
        this.audio.readyState >= 3
      ) {
        this.startedPosition = this.audio.currentTime;
        this.startedMono = performance.now();
        this.startedUtc = new Date().toISOString();
      }
    }, 10000);
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) this.checkpoint();
      if (!this.audio.paused && !this.audio.ended) {
        this.startedPosition = this.audio.currentTime;
        this.startedMono = performance.now();
        this.startedUtc = new Date().toISOString();
      }
    });
  }
  private async organizationState() {
    return (
      (await this.rawGet<Organization>("organization", "state")) ??
      emptyOrganization()
    );
  }
  private async get<T>(store: string, k: string): Promise<T | undefined> {
    const value = await this.rawGet<T>(store, k);
    return store === "tracks" && value
      ? (organize(
          value as unknown as Track,
          await this.organizationState(),
        ) as unknown as T)
      : value;
  }
  private async all<T>(store: string): Promise<T[]> {
    const values = await this.rawAll<T>(store);
    if (store !== "tracks") return values;
    this.identityQueue = (values as unknown as StoredTrack[])
      .filter(
        (t) =>
          !t.demo &&
          !t.identityMetadataRead &&
          !!t.file &&
          !this.identityAttempted.has(t.id),
      )
      .map((t) => t.id);
    const state = await this.organizationState();
    return values.map(
      (t) => organize(t as unknown as Track, state) as unknown as T,
    );
  }
  async organization(): Promise<OrganizationSnapshot> {
    await this.ensureAlbumOrder();
    const state = await this.organizationState(),
      tracks = (await this.rawAll<StoredTrack>("tracks"))
        .filter((t) => !t.hidden)
        .map((t) => this.present(t));
    return new Promise((resolve, reject) => {
      const worker = new Worker(organizationWorker, { type: "module" });
      const timer = setTimeout(() => {
        worker.terminate();
        reject(Error("Library organization timed out. Retry."));
      }, 15000);
      worker.onmessage = async (e) => {
        clearTimeout(timer);
        worker.terminate();
        try {
          if (e.data.error) throw Error(e.data.error);
          if (state.revision !== (await this.organizationState()).revision)
            throw Error("Library organization changed. Retry.");
          resolve({ state, ...e.data });
        } catch (error) {
          reject(error);
        }
      };
      worker.onerror = () => {
        clearTimeout(timer);
        worker.terminate();
        reject(Error("Library organization worker failed"));
      };
      worker.postMessage({ state, tracks });
    });
  }
  async organize(
    revision: number,
    action: OrganizationAction,
  ): Promise<Organization> {
    const db = await this.db;
    const result = await new Promise<Organization>((resolve, reject) => {
      const tx = db.transaction(
        ["organization", "tracks", "settings"],
        "readwrite",
      );
      let next: Organization;
      const state = tx.objectStore("organization").get("state"),
        tracks = tx.objectStore("tracks").getAll();
      tracks.onsuccess = () => {
        try {
          const current =
            (state.result as Organization | undefined) ?? emptyOrganization();
          if (current.revision !== revision)
            throw Error("Library organization changed. Refresh and retry.");
          next = applyOrganization(
            current,
            action,
            (tracks.result as Track[]).map((t) => organize(t, current)),
          );
          tx.objectStore("organization").put(next, "state");
          const settings = tx.objectStore("settings"),
            rev = settings.get("catalog-revision");
          rev.onsuccess = () =>
            settings.put(Number(rev.result ?? 0) + 1, "catalog-revision");
        } catch (error) {
          reject(error);
          tx.abort();
        }
      };
      tx.oncomplete = () => resolve(next);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () =>
        reject(tx.error ?? Error("Organization update cancelled"));
    });
    this.invalidateCatalog();
    this.recommendationRevision++;
    return result;
  }
  async playlistCleanup(id: string): Promise<CleanupPreview> {
    const playlist = (await this.playlists()).find((p) => p.id === id);
    if (!playlist) throw Error("Unknown saved playlist");
    const tracks = await this.all<Track>("tracks"),
      byId = new Map(tracks.map((t) => [t.id, t])),
      seen = new Set<string>();
    return {
      playlist,
      cleaned: {
        ...playlist,
        trackIds: playlist.trackIds.filter((id) => {
          const key = byId.has(id) ? songIdentity(byId.get(id)!) : id;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        }),
      },
      revision: (await this.organizationState()).revision,
    };
  }
  async applyPlaylistCleanup(preview: CleanupPreview, undo: boolean) {
    const db = await this.db;
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(
          ["organization", "playlists", "tracks"],
          "readwrite",
        ),
        state = tx.objectStore("organization").get("state"),
        tracks = tx.objectStore("tracks").getAll(),
        saved = tx.objectStore("playlists").get(preview.playlist.id);
      saved.onsuccess = () => {
        try {
          const org =
            (state.result as Organization | undefined) ?? emptyOrganization();
          if (
            org.revision !== preview.revision ||
            JSON.stringify(saved.result) !==
              JSON.stringify(undo ? preview.cleaned : preview.playlist)
          )
            throw Error("Playlist or organization changed. Refresh and retry.");
          const target = undo ? preview.playlist : preview.cleaned;
          if (!undo) {
            const byId = new Map(
                (tracks.result as Track[]).map((t) => [t.id, organize(t, org)]),
              ),
              seen = new Set<string>();
            const ids = preview.playlist.trackIds.filter((id) => {
              const key = byId.has(id) ? songIdentity(byId.get(id)!) : id;
              if (seen.has(key)) return false;
              seen.add(key);
              return true;
            });
            if (JSON.stringify(ids) !== JSON.stringify(target.trackIds))
              throw Error("Invalid cleanup");
          }
          tx.objectStore("playlists").put(target, target.id);
        } catch (e) {
          reject(e);
          tx.abort();
        }
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error ?? Error("Cleanup cancelled"));
    });
  }
  private async rawGet<T>(store: string, k: string): Promise<T | undefined> {
    const db = await this.db;
    return new Promise((resolve, reject) => {
      const r = db.transaction(store).objectStore(store).get(k);
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
  }
  private async rawAll<T>(store: string): Promise<T[]> {
    const db = await this.db;
    return new Promise((resolve, reject) => {
      const r = db.transaction(store).objectStore(store).getAll();
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
  }
  private async put(store: string, k: string, v: unknown) {
    if (store === "tracks") this.invalidateCatalog();
    const db = await this.db;
    await new Promise<void>((resolve, reject) => {
      const t = db.transaction(
        store === "tracks" ? ["tracks", "settings"] : store,
        "readwrite",
      );
      t.objectStore(store).put(v, k);
      if (store === "tracks") {
        const settings = t.objectStore("settings"),
          revision = settings.get("catalog-revision");
        revision.onsuccess = () =>
          settings.put(Number(revision.result ?? 0) + 1, "catalog-revision");
      }
      t.oncomplete = () => {
        if (store === "tracks") this.invalidateCatalog();
        resolve();
      };
      t.onerror = () => reject(t.error);
    });
  }
  private async remove(store: string, k: string) {
    const db = await this.db;
    await new Promise<void>((resolve, reject) => {
      const t = db.transaction(store, "readwrite");
      t.objectStore(store).delete(k);
      t.oncomplete = () => resolve();
      t.onerror = () => reject(t.error);
    });
  }
  private emit(persist = true) {
    const s = { ...this.state, queue: [...this.state.queue] };
    for (const f of this.listeners) f(s);
    if (persist) void this.put("settings", "queue", s);
  }
  private checkpoint() {
    if (this.startedMono === null || !this.session) return;
    const elapsed = Math.max(
      0,
      Math.min(
        Math.round(performance.now() - this.startedMono),
        Math.round((this.audio.currentTime - this.startedPosition) * 1000),
      ),
    );
    this.startedMono = null;
    if (!elapsed) return;
    const interval: Interval = {
      sessionId: this.session.id,
      sequence: this.sequence++,
      startUtc: this.startedUtc,
      playedMs: elapsed,
    };
    this.session.playedMs += elapsed;
    const session = { ...this.session };
    this.writes = this.writes
      .then(async () => {
        const db = await this.db;
        await new Promise<void>((resolve, reject) => {
          const tx = db.transaction(["intervals", "sessions"], "readwrite");
          tx.objectStore("intervals").put(
            interval,
            interval.sessionId + ":" + interval.sequence,
          );
          tx.objectStore("sessions").put(session, session.id);
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        });
      })
      .catch((e) => {
        this.state.error = String(e);
        this.emit(false);
      });
  }
  private finish(reason: string) {
    this.checkpoint();
    if (this.session) {
      const s = { ...this.session, endReason: reason };
      this.writes = this.writes.then(() => this.put("sessions", s.id, s));
    }
    this.session = null;
  }
  private present(t: Track & { file?: Blob; cover?: Blob }): Track {
    if (t.cover && !this.artwork.has(t.id))
      this.artwork.set(t.id, URL.createObjectURL(t.cover));
    const { file: _, cover: __, ...track } = t;
    return { ...track, artworkUrl: this.artwork.get(t.id) };
  }
  private async ensureAlbumOrder() {
    this.orderReady ??= (async () => {
      await ensureImportOrder(await this.db);
      const { parseBlob } = await import("music-metadata");
      for (const old of await this.all<StoredTrack>("tracks")) {
        if ((old.orderMetadataRead && old.releaseMetadataRead) || old.demo)
          continue;
        try {
          const metadata = await parseBlob(old.file, {
            duration: false,
            skipCovers: true,
          });
          const current = await this.get<StoredTrack>("tracks", old.id);
          if (!current) continue;
          await this.put("tracks", old.id, {
            ...current,
            ...(!current.orderMetadataRead
              ? {
                  trackNumber: metadata.common.track.no || undefined,
                  discNumber: metadata.common.disk.no || undefined,
                  orderMetadataRead: true,
                }
              : {}),
            releaseYear: validReleaseYear(
              metadata.common.year ?? metadata.common.originalyear,
            ),
            releaseMetadataRead: true,
          });
        } catch {
          /* inaccessible legacy sources keep their stable fallback order */
        }
      }
    })();
    await this.orderReady;
  }
  async groupIds(
    kind: "albums" | "artists",
    title: string,
    subtitle: string,
    id?: string,
  ) {
    let offset = 0;
    for (;;) {
      const page = await this.groups(kind, offset);
      const group = page.groups.find((g) =>
        id
          ? g.id === id
          : g.title === title &&
            (kind === "artists" || g.subtitle === subtitle),
      );
      if (group) return group.ids;
      offset += page.groups.length;
      if (offset >= page.total || !page.groups.length) return [];
    }
  }
  async groups(kind: "albums" | "artists", offset = 0, query = "") {
    const snapshot = await this.catalogSnapshot(),
      cacheKey = `${kind}:${snapshot.revision}`;
    let groups = this.catalogGroupsCache.get(cacheKey);
    if (!groups) {
      const entries = new Map<string, Track[]>();
      for (const t of snapshot.tracks) {
        const title =
          kind === "albums"
            ? (t.albumIdentity?.title ?? t.album)
            : leadArtist(t);
        if (!title.trim()) continue;
        const id =
          kind === "albums"
            ? (t.albumIdentity?.id ?? defaultAlbumId(t))
            : artistId(title);
        const ts = entries.get(id) ?? [];
        ts.push(t);
        entries.set(id, ts);
      }
      groups = [...entries.entries()]
        .map(([id, ts]) => {
          ts.sort((a, b) =>
            kind === "artists"
              ? a.album.localeCompare(b.album) || compareAlbumTracks(a, b)
              : compareAlbumTracks(a, b),
          );
          const first = ts[0],
            album = first.albumIdentity,
            selected =
              kind === "albums" ? uniqueSongs(ts).sort(compareAlbumTracks) : ts;
          return {
            id,
            title:
              kind === "albums"
                ? (album?.title ?? first.album)
                : leadArtist(first),
            subtitle:
              kind === "albums" ? (album?.artist ?? albumArtist(first)) : "",
            ids: selected.map((t) => t.id),
            track: ts.find((t) => t.id === album?.coverId) ?? first,
            aliases: [
              ...new Set(
                ts.map((t) =>
                  kind === "albums"
                    ? `${t.album} ${albumArtist(t)}`
                    : `${t.artist} ${t.artistNames?.join(" ") ?? ""}`,
                ),
              ),
            ],
          };
        })
        .sort(
          (a, b) =>
            a.title.localeCompare(b.title) ||
            a.subtitle.localeCompare(b.subtitle),
        );
      this.catalogGroupsCache.set(cacheKey, groups);
      if (this.catalogGroupsCache.size > 2)
        this.catalogGroupsCache.delete(
          this.catalogGroupsCache.keys().next().value!,
        );
    }
    if (query.trim()) {
      const matching = await this.catalogMatcher.match(
        groups.map((g) => ({
          id: g.id!,
          title: g.title,
          artist: g.subtitle,
          album: g.aliases?.join(" ") ?? "",
        })),
        cacheKey,
        query,
      );
      groups = groups
        .filter((g) => matching.has(g.id!))
        .sort((a, b) => matching.get(a.id!)! - matching.get(b.id!)!);
    }
    return {
      groups: groups
        .slice(offset, offset + 60)
        .map((g) => ({ ...g, track: this.present(g.track) })),
      total: groups.length,
    };
  }
  async cover(id: string, _size = 512) {
    const t = await this.get<StoredTrack>("tracks", id);
    if (!t) throw new Error("Unknown track");
    return coverUrl(this.present(t));
  }
  async tracksById(ids: string[]) {
    const ts = await Promise.all(
      ids.map((id) => this.get<StoredTrack>("tracks", id)),
    );
    return ts.filter((t): t is StoredTrack => !!t).map((t) => this.present(t));
  }
  async listTracks(
    query = "",
    offset = 0,
    limit = 60,
    options: import("../types").LibraryOptions = {},
  ) {
    await this.ensureAlbumOrder();
    const snapshot = await this.catalogSnapshot();
    const matching = query.trim()
      ? await this.catalogMatcher.match(
          snapshot.tracks,
          snapshot.revision,
          query,
        )
      : null;
    const tracks = snapshot.tracks
      .filter(
        (t) =>
          (!matching || matching.has(t.id)) &&
          (!options.favoriteOnly || t.favorite),
      )
      .sort(
        (a, b) =>
          (matching?.get(a.id) ?? 0) - (matching?.get(b.id) ?? 0) ||
          compareCatalogTracks(a, b, options.sort ?? "title"),
      );
    return {
      tracks: tracks.slice(offset, offset + limit).map((t) => this.present(t)),
      total: tracks.length,
    };
  }
  async setLibraryVisibility(ids: string[], visible: boolean) {
    this.invalidateCatalog();
    this.recommendationRevision++;
    const db = await this.db;
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(["tracks", "settings"], "readwrite");
      const store = tx.objectStore("tracks");
      const settings = tx.objectStore("settings"),
        revision = settings.get("catalog-revision");
      revision.onsuccess = () =>
        settings.put(Number(revision.result ?? 0) + 1, "catalog-revision");
      for (const id of new Set(ids)) {
        const req = store.get(id);
        req.onsuccess = () => {
          if (req.result) store.put({ ...req.result, hidden: !visible }, id);
        };
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    if (!visible && this.state.queue.length) {
      const queue = this.state.queue.filter(
        (id) => !ids.includes(id) || id === this.state.trackId,
      );
      this.state.queue = queue;
      this.state.queueIndex = Math.max(0, queue.indexOf(this.state.trackId!));
      this.emit();
    }
    this.invalidateCatalog();
  }
  async shareAudio(ids: string[]): Promise<import("../types").ShareOutcome> {
    const files = await Promise.all(
      ids.map(async (id) => {
        const t = await this.get<StoredTrack>("tracks", id);
        if (!t || !t.available) throw new Error("Audio source is unavailable");
        const ext =
          (
            {
              "audio/wav": "wav",
              "audio/mpeg": "mp3",
              "audio/flac": "flac",
              "audio/ogg": "ogg",
              "audio/mp4": "m4a",
            } as Record<string, string>
          )[t.file.type] ?? "audio";
        return new File(
          [t.file],
          `${t.title.replace(/[\\/:*?"<>|]/g, "_")}.${ext}`,
          { type: t.file.type },
        );
      }),
    );
    if (navigator.canShare?.({ files })) {
      try {
        await navigator.share({ files });
        return "opened";
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError")
          return "canceled";
        throw e;
      }
    }
    for (const file of files) {
      const url = URL.createObjectURL(file);
      const a = document.createElement("a");
      a.href = url;
      a.download = file.name;
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    }
    return "download";
  }
  soundCapabilities() {
    return this.sound.state();
  }
  setSound(config: import("../sound/types").SoundConfig) {
    return this.sound.configure(config);
  }
  soundAction(action: import("../sound/types").SoundAction) {
    return this.sound.action(action);
  }

  async importMusic(
    files: File[] = [],
    _mode?: string,
    onProgress?: (progress: import("../types").ImportProgress) => void,
  ) {
    this.cancelled = false;
    let count = 0;
    onProgress?.({ imported: 0, failed: 0 });
    await ensureImportOrder(await this.db);
    const { parseBlob } = await import("music-metadata");
    for (const file of files) {
      if (this.cancelled) break;
      if (
        !file.type.startsWith("audio/") &&
        !/\.(mp3|flac|wav|m4a|ogg|opus|aac)$/i.test(file.name)
      )
        continue;
      const prefix = new Uint8Array(await file.slice(0, 65536).arrayBuffer()),
        suffix = new Uint8Array(
          await file.slice(Math.max(0, file.size - 65536)).arrayBuffer(),
        ),
        sizeBytes = new TextEncoder().encode(String(file.size)),
        identity = new Uint8Array(
          sizeBytes.length + prefix.length + suffix.length,
        );
      identity.set(sizeBytes);
      identity.set(prefix, sizeBytes.length);
      identity.set(suffix, sizeBytes.length + prefix.length);
      const id =
        "local-" +
        Array.from(
          new Uint8Array(await crypto.subtle.digest("SHA-256", identity)),
        )
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("");
      let artistNames: string[] = [],
        albumArtist: string | undefined;
      let title = file.name.replace(/\.[^.]+$/, ""),
        artist = "",
        album = "",
        genre = "",
        durationMs = 0,
        audioChannels: number | undefined,
        releaseYear: number | undefined,
        trackNumber: number | undefined,
        discNumber: number | undefined,
        cover: Blob | undefined;
      try {
        const m = await parseBlob(file, { duration: true });
        title = m.common.title || title;
        artist = m.common.artist || "";
        artistNames = importedArtistNames(artist, m.common.artists);
        albumArtist = m.common.albumartist;
        album = m.common.album || "";
        genre = m.common.genre?.join(", ") || "";
        durationMs = Math.round((m.format.duration || 0) * 1000);
        audioChannels = m.format.numberOfChannels;
        releaseYear = validReleaseYear(m.common.year ?? m.common.originalyear);
        trackNumber = m.common.track.no || undefined;
        discNumber = m.common.disk.no || undefined;
        const p = m.common.picture?.[0];
        if (p && p.data.byteLength <= 8 * 1024 * 1024) {
          try {
            const image = await createImageBitmap(
              new Blob([new Uint8Array(p.data)], { type: p.format }),
              { resizeWidth: 512, resizeHeight: 512 },
            );
            const canvas = new OffscreenCanvas(512, 512);
            canvas.getContext("2d")!.drawImage(image, 0, 0);
            cover = await canvas.convertToBlob({ type: "image/png" });
            image.close();
          } catch {
            /* corrupt embedded art falls back */
          }
        }
      } catch {
        /* filename metadata fallback */
      }
      const existing = await this.get<StoredTrack>("tracks", id);
      await putImportedTrack(await this.db, {
        id,
        title,
        artist,
        album,
        genre,
        durationMs,
        audioChannels,
        trackNumber,
        discNumber,
        orderMetadataRead: true,
        releaseYear,
        releaseMetadataRead: true,
        artistNames,
        albumArtist,
        identityMetadataRead: true,
        sourceUri: "browser-file:" + id,
        favorite: existing?.favorite ?? false,
        available: true,
        file,
        cover,
      });
      this.invalidateCatalog();
      count++;
      if (count % 10 === 0) onProgress?.({ imported: count, failed: 0 });
    }
    onProgress?.({ imported: count, failed: 0 });
    return count;
  }
  async cancelImport() {
    this.cancelled = true;
  }
  async addSamples() {
    await ensureImportOrder(await this.db);
    const names = [
      "Signal in amber",
      "A quieter orbit",
      "Between the lines",
      "Last light",
      "Small hours",
      "The long way home",
      "Soft geometry",
      "Blue after rain",
    ];
    for (let i = 0; i < names.length; i++) {
      const id = "sample-" + i;
      const existing = await this.get<StoredTrack>("tracks", id);
      if (existing) {
        if (existing.hidden)
          await this.put("tracks", id, { ...existing, hidden: false });
        continue;
      }
      const rate = 16000,
        len = rate * 40,
        buffer = new ArrayBuffer(44 + len * 2),
        v = new DataView(buffer);
      const str = (offset: number, s: string) => {
        for (let j = 0; j < s.length; j++)
          v.setUint8(offset + j, s.charCodeAt(j));
      };
      str(0, "RIFF");
      v.setUint32(4, 36 + len * 2, true);
      str(8, "WAVE");
      str(12, "fmt ");
      v.setUint32(16, 16, true);
      v.setUint16(20, 1, true);
      v.setUint16(22, 1, true);
      v.setUint32(24, rate, true);
      v.setUint32(28, rate * 2, true);
      v.setUint16(32, 2, true);
      v.setUint16(34, 16, true);
      str(36, "data");
      v.setUint32(40, len * 2, true);
      const f = 110 * Math.pow(2, i / 12);
      for (let j = 0; j < len; j++) {
        const t = j / rate,
          e = Math.min(t / 2, 1, (40 - t) / 2);
        const s =
          (Math.sin(t * f * 2 * Math.PI) +
            0.35 * Math.sin(t * f * 3 * Math.PI) +
            0.12 * Math.sin(t * f * 4 * Math.PI)) *
          0.12 *
          e *
          (0.7 + 0.3 * Math.sin(t * 0.7));
        v.setInt16(44 + j * 2, s * 32767, true);
      }
      await putImportedTrack(await this.db, {
        id,
        title: names[i],
        artist: [
          "Field Notes",
          "Parallel Lines",
          "Night Studies",
          "Quiet Assembly",
        ][i % 4],
        album: ["Amber studies", "Blue hour"][i % 2],
        genre: i % 2 ? "Ambient" : "Post-rock",
        durationMs: 40000,
        sourceUri: "sample:" + id,
        favorite: i === 0,
        available: true,
        demo: true,
        file: new Blob([buffer], { type: "audio/wav" }),
      });
    }
    this.invalidateCatalog();
    return names.length;
  }
  async setFavorite(id: string, favorite: boolean) {
    this.recommendationRevision++;
    const t = await this.get<StoredTrack>("tracks", id);
    if (t) await this.put("tracks", id, { ...t, favorite });
  }
  async automaticPlaylists() {
    this.checkpoint();
    if (!this.audio.paused && !this.audio.ended && this.audio.readyState >= 3) {
      this.startedPosition = this.audio.currentTime;
      this.startedMono = performance.now();
      this.startedUtc = new Date().toISOString();
    }
    await this.writes;
    const db = await this.db;
    await ensureImportOrder(db);
    const tracks = await this.all<StoredTrack>("tracks");
    const added = [...tracks]
      .sort(
        (a, b) =>
          (b.importSequence ?? -Infinity) - (a.importSequence ?? -Infinity),
      )
      .map((t) => t.id);
    return automaticPlaylists(
      tracks,
      await this.all<Session>("sessions"),
      await this.all<Interval>("intervals"),
      added,
    );
  }
  async playlists() {
    return this.all<Playlist>("playlists");
  }
  async savePlaylist(p: Playlist) {
    if (p.kind === "automatic" || p.id.startsWith("automatic:"))
      throw Error("Automatic collections cannot be edited");
    const db = await this.db;
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(
          ["tracks", "organization", "playlists"],
          "readwrite",
        ),
        saved = tx.objectStore("playlists").get(p.id),
        tracks = tx.objectStore("tracks").getAll(),
        organization = tx.objectStore("organization").get("state");
      let reads = 0;
      const validate = () => {
        if (++reads !== 3) return;
        try {
          const state =
              (organization.result as Organization | undefined) ??
              emptyOrganization(),
            byId = new Map(
              (tracks.result as Track[]).map((t) => [t.id, organize(t, state)]),
            ),
            previous = new Map<string, number>(),
            counts = new Map<string, number>();
          for (const id of (saved.result as Playlist | undefined)?.trackIds ??
            []) {
            const t = byId.get(id);
            if (t)
              previous.set(
                songIdentity(t),
                (previous.get(songIdentity(t)) ?? 0) + 1,
              );
          }
          for (const id of p.trackIds) {
            const t = byId.get(id);
            if (!t) throw Error("Unknown track");
            const key = songIdentity(t);
            counts.set(key, (counts.get(key) ?? 0) + 1);
          }
          if (
            [...counts].some(
              ([key, n]) => n > Math.max(1, previous.get(key) ?? 0),
            )
          )
            throw Error("This song is already represented in the playlist.");
          tx.objectStore("playlists").put(
            {
              id: p.id,
              title: p.title,
              kind: p.kind,
              trackIds: [...p.trackIds],
            },
            p.id,
          );
        } catch (error) {
          reject(error);
          tx.abort();
        }
      };
      saved.onsuccess = validate;
      tracks.onsuccess = validate;
      organization.onsuccess = validate;
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error ?? Error("Playlist save cancelled"));
    });
  }
  async deletePlaylist(id: string) {
    if (id.startsWith("automatic:"))
      throw new Error("Automatic collections cannot be deleted");
    await this.remove("playlists", id);
  }
  async generatePlaylist(request: PlaylistRequest) {
    this.checkpoint();
    if (!this.audio.paused && !this.audio.ended && this.audio.readyState >= 3) {
      this.startedPosition = this.audio.currentTime;
      this.startedMono = performance.now();
      this.startedUtc = new Date().toISOString();
    }
    await this.writes;
    const settings = await this.settings();
    const revision = this.recommendationRevision;
    const snapshot = await this.recommendationSnapshot();
    const ranked = request.blend
      ? await browserRanking({
          request,
          tracks: snapshot.tracks.map(
            ({ file: _, cover: __, ...track }) => track,
          ),
          sessions: snapshot.sessions,
          zone: snapshot.settings?.timeZone ?? settings.timeZone,
          data: snapshot.data,
          now: new Date().toISOString(),
        })
      : undefined;
    const ids = generate(
      request,
      snapshot.tracks,
      snapshot.sessions,
      settings.timeZone,
    );
    if (revision !== this.recommendationRevision)
      throw new Error("Suggestions changed. Generate again.");
    return {
      id: crypto.randomUUID(),
      title: request.title.trim() || "A mix for you",
      kind: "generated" as const,
      trackIds: ranked?.ids ?? ids,
      recommendation: ranked?.recommendation,
    };
  }
  async settings() {
    let s = await this.get<Settings>("settings", "preferences");
    if (!s) {
      s = {
        recapPeriod: "year",
        language: "en",
        theme: "system",
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        historyEnabledSince: new Date().toISOString(),
      };
      await this.put("settings", "preferences", s);
    }
    const deviceZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (s.timeZone !== deviceZone) {
      s = { ...s, timeZone: deviceZone };
      await this.put("settings", "preferences", s);
    }
    return { ...s, recapPeriod: s.recapPeriod ?? "year" };
  }
  private async updatePreferences(update: (current: Settings) => Settings) {
    await this.settings();
    const db = await this.db;
    return new Promise<Settings>((resolve, reject) => {
      const tx = db.transaction("settings", "readwrite"),
        store = tx.objectStore("settings");
      const request = store.get("preferences");
      let next: Settings;
      request.onsuccess = () => {
        next = update(request.result as Settings);
        store.put(next, "preferences");
      };
      tx.oncomplete = () => resolve(next);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  }
  async saveSettings(s: Settings) {
    await this.updatePreferences((current) => ({
      ...s,
      privacyRevision: current.privacyRevision ?? 0,
      historyEnabledSince: current.historyEnabledSince,
    }));
  }
  async recap(request: RecapRequest) {
    this.checkpoint();
    if (!this.audio.paused && !this.audio.ended) {
      this.startedPosition = this.audio.currentTime;
      this.startedMono = performance.now();
      this.startedUtc = new Date().toISOString();
    }
    await this.writes;
    const revision = (await this.organizationState()).revision;
    const result = aggregate(
      request,
      await this.settings(),
      (await this.all<StoredTrack>("tracks")).map((t) => this.present(t)),
      await this.all<Session>("sessions"),
      await this.all<Interval>("intervals"),
    );
    if (revision !== (await this.organizationState()).revision)
      throw Error("Library organization changed. Retry.");
    return { ...result, organizationRevision: revision };
  }
  async saveSnapshot(r: Recap) {
    const copy = structuredClone(r);
    for (const t of copy.topTracks) t.track.artworkUrl = undefined;
    await this.put("snapshots", crypto.randomUUID(), copy);
  }
  async snapshots() {
    return (await this.all<unknown>("snapshots")).map(normalizeRecap);
  }
  async deleteHistory() {
    this.recommendationRevision++;
    this.finish("history-deleted");
    await this.writes;
    const db = await this.db;
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(
        ["sessions", "intervals", "snapshots"],
        "readwrite",
      );
      for (const s of ["sessions", "intervals", "snapshots"])
        tx.objectStore(s).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    await this.updatePreferences((current) => ({
      ...current,
      historyEnabledSince: new Date().toISOString(),
      privacyRevision: (current.privacyRevision ?? 0) + 1,
    }));
    if (!this.audio.paused) {
      this.session = {
        id: crypto.randomUUID(),
        trackId: this.state.trackId!,
        startedAtUtc: new Date().toISOString(),
        playedMs: 0,
        excluded: this.state.excluded,
      };
      this.sequence = 0;
      this.startedPosition = this.audio.currentTime;
      this.startedMono = performance.now();
      this.startedUtc = new Date().toISOString();
    }
  }
  async playback() {
    await this.ready;
    return { ...this.state };
  }
  async subscribe(cb: (s: PlaybackSnapshot) => void) {
    await this.ready;
    this.listeners.add(cb);
    cb({ ...this.state });
    return () => {
      this.listeners.delete(cb);
    };
  }
  async play(ids: string[], index?: number) {
    this.analysis.activity(false);
    await this.ready;
    if (this.changing) return;
    this.changing = true;
    try {
      const selected = index === undefined ? undefined : ids[index];
      const visible = new Set(
        (await this.all<StoredTrack>("tracks"))
          .filter((t) => !t.hidden)
          .map((t) => t.id),
      );
      ids = ids.filter((id) => visible.has(id));
      index = index === undefined ? 0 : ids.indexOf(selected!);
      if (!ids.length || index < 0)
        throw new Error("Track was removed from Library.");
      this.audio.pause();
      this.finish("queue-transition");
      const t = await this.get<StoredTrack>("tracks", ids[index]);
      if (!t) throw new Error("This track is unavailable.");
      this.state = {
        ...this.state,
        queue: [...ids],
        queueIndex: index,
        trackId: t.id,
        durationMs: t.durationMs,
        positionMs: 0,
        playing: false,
        excluded: !!t.demo || this.privateMode,
        error: undefined,
      };
      if (!this.urls.has(t.id))
        this.urls.set(t.id, URL.createObjectURL(t.file));
      this.audio.src = this.urls.get(t.id)!;
      this.emit();
      if (!t.audioChannels) {
        try {
          const { parseBlob } = await import("music-metadata");
          t.audioChannels = (await parseBlob(t.file)).format.numberOfChannels;
          await this.put("tracks", t.id, t);
        } catch {
          /* Unknown formats retain the browser's stereo output. */
        }
      }
      this.sound.format(t.audioChannels ?? 2);
      this.sound.reset();
      await this.sound.activate();
      await this.audio.play();
    } catch (e) {
      this.state.error = String(e);
      this.state.playing = !this.audio.paused;
      this.emit();
    } finally {
      this.changing = false;
    }
  }
  async toggle() {
    await this.ready;
    if (!this.audio.src && this.state.trackId) {
      const ms = this.state.positionMs;
      await this.play(this.state.queue, this.state.queueIndex);
      await this.seek(ms);
      return;
    }
    if (this.audio.paused) {
      await this.sound.activate();
      await this.audio.play();
    } else this.audio.pause();
  }
  async seek(ms: number) {
    this.sound.reset();
    this.checkpoint();
    this.audio.currentTime =
      Math.max(0, Math.min(ms, this.state.durationMs)) / 1000;
    this.state.positionMs = this.audio.currentTime * 1000;
    if (!this.audio.paused) {
      this.startedPosition = this.audio.currentTime;
      this.startedMono = performance.now();
      this.startedUtc = new Date().toISOString();
    }
    this.emit();
  }
  async next() {
    if (!this.state.queue.length) return;
    this.recent.push(this.state.queueIndex);
    const index =
      this.state.shuffle && this.state.queue.length > 1
        ? (this.state.queueIndex +
            1 +
            Math.floor(Math.random() * (this.state.queue.length - 1))) %
          this.state.queue.length
        : (this.state.queueIndex + 1) % this.state.queue.length;
    await this.play(this.state.queue, index);
  }
  async previous() {
    if (this.audio.currentTime > 3) {
      await this.seek(0);
      return;
    }
    await this.play(
      this.state.queue,
      this.recent.pop() ?? Math.max(0, this.state.queueIndex - 1),
    );
  }
  async setShuffle(value: boolean) {
    this.state.shuffle = value;
    this.emit();
  }
  async setRepeat(value: PlaybackSnapshot["repeat"]) {
    this.state.repeat = value;
    this.emit();
  }
  async setExcluded(value: boolean) {
    this.recommendationRevision++;
    this.checkpoint();
    const t = this.state.trackId
      ? await this.get<StoredTrack>("tracks", this.state.trackId)
      : undefined;
    this.privateMode = value;
    this.state.excluded = !!t?.demo || value;
    if (this.session) {
      if (this.session.excluded !== this.state.excluded) {
        await this.updatePreferences((current) => ({
          ...current,
          privacyRevision: (current.privacyRevision ?? 0) + 1,
        }));
      }
      this.session.excluded = this.state.excluded;
      await this.put("sessions", this.session.id, { ...this.session });
    }
    if (!this.audio.paused) {
      this.startedPosition = this.audio.currentTime;
      this.startedMono = performance.now();
      this.startedUtc = new Date().toISOString();
    }
    this.emit();
  }
  async reorderQueue(ids: string[]) {
    const i = ids.indexOf(this.state.trackId!);
    if (i < 0) throw new Error("The playing track must remain in the queue.");
    this.state.queue = [...ids];
    this.state.queueIndex = i;
    this.emit();
  }
}
