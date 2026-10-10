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
} from "../types";
import {
  aggregate,
  generate,
  coverUrl,
  compareAlbumTracks,
  compareCatalogTracks,
} from "../domain";
type StoredTrack = Track & { file: Blob; cover?: Blob };
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
  private db: Promise<IDBDatabase>;
  private audio = new Audio();
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
  constructor() {
    this.db = new Promise((resolve, reject) => {
      const r = indexedDB.open("local-music-v1", 1);
      r.onupgradeneeded = () => {
        for (const name of [
          "tracks",
          "sessions",
          "intervals",
          "playlists",
          "settings",
          "snapshots",
        ])
          r.result.createObjectStore(name);
      };
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
    this.ready = this.get<PlaybackSnapshot>("settings", "queue").then((v) => {
      if (v) {
        this.state = { ...v, playing: false, error: undefined };
        this.privateMode = !v.trackId?.startsWith("sample-") && v.excluded;
      }
    });
    this.audio.addEventListener("playing", () => {
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
  private async get<T>(store: string, k: string): Promise<T | undefined> {
    const db = await this.db;
    return new Promise((resolve, reject) => {
      const r = db.transaction(store).objectStore(store).get(k);
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
  }
  private async all<T>(store: string): Promise<T[]> {
    const db = await this.db;
    return new Promise((resolve, reject) => {
      const r = db.transaction(store).objectStore(store).getAll();
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
  }
  private async put(store: string, k: string, v: unknown) {
    const db = await this.db;
    await new Promise<void>((resolve, reject) => {
      const t = db.transaction(store, "readwrite");
      t.objectStore(store).put(v, k);
      t.oncomplete = () => resolve();
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
  private present(t: StoredTrack): Track {
    if (t.cover && !this.artwork.has(t.id))
      this.artwork.set(t.id, URL.createObjectURL(t.cover));
    const { file: _, cover: __, ...track } = t;
    return { ...track, artworkUrl: this.artwork.get(t.id) };
  }
  private async ensureAlbumOrder() {
    this.orderReady ??= (async () => {
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
  async groupIds(kind: "albums" | "artists", title: string, subtitle: string) {
    await this.ensureAlbumOrder();
    return (await this.all<StoredTrack>("tracks"))
      .filter((track) => !track.hidden)
      .filter((track) =>
        kind === "artists"
          ? track.artist === title
          : track.album === title && track.artist === subtitle,
      )
      .sort((a, b) =>
        kind === "albums"
          ? compareAlbumTracks(a, b)
          : a.album.localeCompare(b.album) || compareAlbumTracks(a, b),
      )
      .map((track) => track.id);
  }
  async groups(kind: "albums" | "artists", offset = 0) {
    await this.ensureAlbumOrder();
    const all = (await this.all<StoredTrack>("tracks"))
      .filter((t) => !t.hidden)
      .sort(
        (a, b) => a.album.localeCompare(b.album) || compareAlbumTracks(a, b),
      );
    const map = new Map<string, import("../types").CatalogGroup>();
    for (const t of all) {
      const title = kind === "albums" ? t.album : t.artist;
      if (!title) continue;
      const k = kind === "albums" ? t.artist + "|" + t.album : t.artist;
      const g = map.get(k) ?? {
        title,
        subtitle: kind === "albums" ? t.artist : "",
        ids: [],
        track: this.present(t),
      };
      g.ids.push(t.id);
      map.set(k, g);
    }
    const groups = [...map.values()].sort((a, b) =>
      a.title.localeCompare(b.title),
    );
    return { groups: groups.slice(offset, offset + 60), total: groups.length };
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
    const q = query.toLowerCase();
    const tracks = (await this.all<StoredTrack>("tracks"))
      .filter((t) => !t.hidden)
      .filter((t) =>
        (t.title + " " + t.artist + " " + t.album).toLowerCase().includes(q),
      )
      .filter((t) => !options.favoriteOnly || t.favorite)
      .sort((a, b) => compareCatalogTracks(a, b, options.sort ?? "title"));
    return {
      tracks: tracks.slice(offset, offset + limit).map((t) => this.present(t)),
      total: tracks.length,
    };
  }
  async searchCatalog(query: string, limit = 30) {
    await this.ensureAlbumOrder();
    const terms = query.trim().normalize("NFKC").toLowerCase().split(/\s+/);
    const matches = (s: string) =>
      terms.every((q) => s.normalize("NFKC").toLowerCase().includes(q));
    const tracks = (await this.all<StoredTrack>("tracks"))
      .filter((t) => !t.hidden && matches(`${t.title} ${t.artist} ${t.album}`))
      .sort((a, b) => a.title.localeCompare(b.title))
      .map((t) => this.present(t));
    const findGroups = async (kind: "albums" | "artists") => {
      const found: import("../types").CatalogGroup[] = [];
      let offset = 0;
      for (;;) {
        const page = await this.groups(kind, offset);
        found.push(
          ...page.groups.filter((g) => matches(`${g.title} ${g.subtitle}`)),
        );
        offset += page.groups.length;
        if (found.length > limit || offset >= page.total) break;
      }
      return found;
    };
    const albums = await findGroups("albums"),
      artists = await findGroups("artists"),
      playlists = (await this.playlists()).filter((p) => matches(p.title));
    return {
      tracks: tracks.slice(0, limit),
      albums: albums.slice(0, limit),
      artists: artists.slice(0, limit),
      playlists: playlists.slice(0, limit),
      hasMore: [tracks, albums, artists, playlists].some(
        (items) => items.length > limit,
      ),
    };
  }
  async setLibraryVisibility(ids: string[], visible: boolean) {
    const db = await this.db;
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("tracks", "readwrite");
      const store = tx.objectStore("tracks");
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
  async soundCapabilities() {
    return {
      equalizer: false,
      systemPanel: false,
      enabled: false,
      preset: 0,
      presets: [],
    };
  }
  async setEqualizer(_enabled: boolean, _preset: number): Promise<void> {
    throw new Error("Equalizer is unavailable in browser preview");
  }
  async openSoundPanel(): Promise<void> {
    throw new Error("Device sound settings are unavailable in browser preview");
  }
  async importMusic(
    files: File[] = [],
    _mode?: string,
    onProgress?: (progress: import("../types").ImportProgress) => void,
  ) {
    this.cancelled = false;
    let count = 0;
    onProgress?.({ imported: 0, failed: 0 });
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
      let title = file.name.replace(/\.[^.]+$/, ""),
        artist = "",
        album = "",
        genre = "",
        durationMs = 0,
        releaseYear: number | undefined,
        trackNumber: number | undefined,
        discNumber: number | undefined,
        cover: Blob | undefined;
      try {
        const m = await parseBlob(file, { duration: true });
        title = m.common.title || title;
        artist = m.common.artist || "";
        album = m.common.album || "";
        genre = m.common.genre?.join(", ") || "";
        durationMs = Math.round((m.format.duration || 0) * 1000);
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
      await this.put("tracks", id, {
        id,
        title,
        artist,
        album,
        genre,
        durationMs,
        trackNumber,
        discNumber,
        orderMetadataRead: true,
        releaseYear,
        releaseMetadataRead: true,
        sourceUri: "browser-file:" + id,
        favorite: existing?.favorite ?? false,
        available: true,
        file,
        cover,
      });
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
      await this.put("tracks", id, {
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
    return names.length;
  }
  async setFavorite(id: string, favorite: boolean) {
    const t = await this.get<StoredTrack>("tracks", id);
    if (t) await this.put("tracks", id, { ...t, favorite });
  }
  async playlists() {
    return this.all<Playlist>("playlists");
  }
  async savePlaylist(p: Playlist) {
    await this.put("playlists", p.id, p);
  }
  async deletePlaylist(id: string) {
    await this.remove("playlists", id);
  }
  async generatePlaylist(request: PlaylistRequest) {
    await this.writes;
    const settings = await this.settings();
    const ids = generate(
      request,
      await this.all<StoredTrack>("tracks"),
      await this.all<Session>("sessions"),
      settings.timeZone,
    );
    return {
      id: crypto.randomUUID(),
      title: request.title || "A mix for you",
      kind: "generated" as const,
      trackIds: ids,
    };
  }
  async settings() {
    let s = await this.get<Settings>("settings", "preferences");
    if (!s) {
      s = {
        language: "en",
        theme: "system",
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        historyEnabledSince: new Date().toISOString(),
      };
      await this.put("settings", "preferences", s);
    }
    return s;
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
  async recap(year: number) {
    this.checkpoint();
    if (!this.audio.paused && !this.audio.ended) {
      this.startedPosition = this.audio.currentTime;
      this.startedMono = performance.now();
      this.startedUtc = new Date().toISOString();
    }
    await this.writes;
    return aggregate(
      year,
      await this.settings(),
      (await this.all<StoredTrack>("tracks")).map((t) => this.present(t)),
      await this.all<Session>("sessions"),
      await this.all<Interval>("intervals"),
    );
  }
  async saveSnapshot(r: Recap) {
    const copy = structuredClone(r);
    for (const t of copy.topTracks) t.track.artworkUrl = undefined;
    await this.put("snapshots", r.year + ":" + Date.now(), copy);
  }
  async snapshots() {
    return this.all<Recap>("snapshots");
  }
  async deleteHistory() {
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
    if (this.audio.paused) await this.audio.play();
    else this.audio.pause();
  }
  async seek(ms: number) {
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
