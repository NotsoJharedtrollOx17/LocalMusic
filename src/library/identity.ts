import type { Track } from "../types";
export interface SongLink {
  id: string;
  ids: string[];
  preferred: string;
}
export interface AlbumLink {
  id: string;
  keys: string[];
  title: string;
  artist: string;
  coverId: string;
}
export interface AlbumIdentity {
  id: string;
  title: string;
  artist: string;
  coverId: string;
}
export interface Organization {
  revision: number;
  artists: Record<string, string>;
  songs: SongLink[];
  albums: AlbumLink[];
  dismissed: string[];
}
export type OrganizationAction =
  | { op: "artist"; ids: string[]; name: string | null }
  | { op: "songLink"; ids: string[]; preferred: string }
  | { op: "songUnlink"; id: string }
  | {
      op: "albumLink";
      keys: string[];
      title: string;
      artist: string;
      coverId: string;
    }
  | { op: "albumUnlink"; id: string }
  | { op: "dismiss"; signature: string };
export interface OrganizationSnapshot {
  state: Organization;
  tracks: Track[];
  songCandidates: Candidate[];
  albumCandidates: Candidate[];
}
export interface CleanupPreview {
  playlist: import("../types").Playlist;
  cleaned: import("../types").Playlist;
  revision: number;
}
export const emptyOrganization = (): Organization => ({
  revision: 0,
  artists: {},
  songs: [],
  albums: [],
  dismissed: [],
});
export const normalized = (s: string) =>
  s.normalize("NFKC").trim().toLowerCase().split(/\s+/u).join(" ");
export function opaque(prefix: string, value: string) {
  let h = 14695981039346656037n;
  for (const c of new TextEncoder().encode(value))
    h = BigInt.asUintN(64, (h ^ BigInt(c)) * 1099511628211n);
  return prefix + h.toString(16).padStart(16, "0");
}
/** Parsers may synthesize ARTISTS by echoing a joined ARTIST credit. */
export function importedArtistNames(
  credit: string,
  names: string[] | undefined,
): string[] {
  const values = (names ?? []).map((s) => s.trim()).filter(Boolean);
  return values.length === 1 && normalized(values[0]) === normalized(credit)
    ? []
    : values;
}
export function leadArtist(t: Track): string {
  if (t.primaryArtist !== undefined) return t.primaryArtist;
  const structured = t.artistNames?.find((x) => x.trim());
  if (structured) return structured.trim();
  return t.artist.split(/\s+(?:feat\.?|ft\.?|featuring)\s+(?=\S)/iu)[0].trim();
}
export const songIdentity = (t: Track) => t.songIdentity || t.id;
export const albumArtist = (t: Track) => t.albumArtist?.trim() || leadArtist(t);
export const defaultAlbumId = (t: Track) =>
  opaque(
    "album:",
    JSON.stringify([normalized(albumArtist(t)), normalized(t.album)]),
  );
export const baseAlbumId = (t: Track) => t.sourceAlbumId ?? defaultAlbumId(t);
export const artistId = (s: string) => opaque("artist:", normalized(s));
export function organize<T extends Track>(t: T, state: Organization): T {
  const original = {
    ...t,
    primaryArtist: undefined,
    songIdentity: undefined,
    preferredCopy: undefined,
    albumIdentity: undefined,
  };
  const sourceAlbumId = baseAlbumId(original);
  const primaryArtist = state.artists[t.id] ?? leadArtist(original);
  const song = state.songs.find((g) => g.ids.includes(t.id));
  const base = { ...original, sourceAlbumId, primaryArtist };
  const album = state.albums.find((g) => g.keys.includes(baseAlbumId(base)));
  return {
    ...base,
    songIdentity: song?.id,
    preferredCopy: song?.preferred === t.id,
    albumIdentity: album
      ? {
          id: album.id,
          title: album.title,
          artist: album.artist,
          coverId: album.coverId,
        }
      : undefined,
  };
}
export function uniqueSongs<T extends Track>(tracks: T[]): T[] {
  const groups = new Map<string, T>();
  for (const t of tracks) {
    const k = songIdentity(t),
      old = groups.get(k);
    if (
      !old ||
      (t.available && !t.hidden && !(old.available && !old.hidden)) ||
      (!!(t.available && !t.hidden) === !!(old.available && !old.hidden) &&
        t.preferredCopy &&
        !old.preferredCopy)
    )
      groups.set(k, t);
  }
  return [...groups.values()];
}
export function candidateSong(a: Track, b: Track) {
  return (
    a.id !== b.id &&
    songIdentity(a) !== songIdentity(b) &&
    normalized(a.title) === normalized(b.title) &&
    !!normalized(leadArtist(a)) &&
    normalized(leadArtist(a)) === normalized(leadArtist(b)) &&
    a.durationMs > 0 &&
    b.durationMs > 0 &&
    Math.abs(a.durationMs - b.durationMs) <= 2000
  );
}
export function pairSignature(kind: string, a: Track[], b: Track[]) {
  const sig = (ts: Track[]) =>
    ts
      .map((t) =>
        JSON.stringify([
          t.id,
          t.title,
          t.artist,
          t.artistNames ?? [],
          t.albumArtist ?? null,
          t.primaryArtist ?? null,
          t.album,
          t.durationMs,
        ]),
      )
      .sort()
      .join("|");
  return opaque(kind + ":", [sig(a), sig(b)].sort().join("::"));
}
export function sourceAlbums(tracks: Track[]) {
  const groups = new Map<string, Track[]>();
  for (const t of tracks) {
    if (!t.album.trim()) continue;
    const k = baseAlbumId(t),
      g = groups.get(k) ?? [];
    g.push(t);
    groups.set(k, g);
  }
  return groups;
}
const editions = (s: string) =>
  [
    ...s
      .toLowerCase()
      .matchAll(
        /\b(deluxe|remaster(?:ed)?|anniversary|expanded|live|remix|special edition)\b/g,
      ),
  ]
    .map((x) => x[0])
    .sort()
    .join("|");
export function candidateAlbum(a: Track[], b: Track[]) {
  if (
    !a.length ||
    !b.length ||
    normalized(albumArtist(a[0])) !== normalized(albumArtist(b[0])) ||
    editions(a[0].album) !== editions(b[0].album)
  )
    return false;
  if (normalized(a[0].album) === normalized(b[0].album)) return true;
  const left = uniqueSongs(a),
    right = uniqueSongs(b),
    used = new Set<string>();
  let matches = 0;
  for (const t of left) {
    const found = right.find(
      (u) =>
        !used.has(u.id) &&
        (songIdentity(t) === songIdentity(u) || candidateSong(t, u)),
    );
    if (found) {
      used.add(found.id);
      matches++;
    }
  }
  return matches >= 2 && matches / Math.min(left.length, right.length) >= 0.8;
}
export function applyOrganization(
  state: Organization,
  action: OrganizationAction,
  tracks: Track[],
): Organization {
  const next = structuredClone(state),
    byId = new Map(tracks.map((t) => [t.id, t]));
  if (action.op === "artist") {
    if (
      !action.ids.length ||
      action.ids.some((id) => !byId.has(id)) ||
      (action.name !== null &&
        (!action.name.trim() || action.name.length > 240))
    )
      throw Error("Invalid artist correction");
    for (const id of action.ids)
      if (action.name === null) delete next.artists[id];
      else next.artists[id] = action.name.trim();
  }
  if (action.op === "songLink") {
    const ids = new Set(action.ids);
    for (const group of next.songs)
      if (group.ids.some((id) => ids.has(id)))
        group.ids.forEach((id) => ids.add(id));
    if (
      ids.size < 2 ||
      !ids.has(action.preferred) ||
      [...ids].some((id) => !byId.has(id))
    )
      throw Error("Invalid song link");
    next.songs = next.songs.filter((g) => !g.ids.some((id) => ids.has(id)));
    next.songs.push({
      id:
        state.songs.find((g) => g.ids.some((id) => ids.has(id)))?.id ??
        crypto.randomUUID(),
      ids: [...ids].sort(),
      preferred: action.preferred,
    });
  }
  if (action.op === "songUnlink")
    next.songs = next.songs.filter((g) => g.id !== action.id);
  if (action.op === "albumLink") {
    const keys = new Set(action.keys);
    for (const g of next.albums)
      if (g.keys.some((k) => keys.has(k))) g.keys.forEach((k) => keys.add(k));
    const originals = sourceAlbums(tracks);
    if (
      !keys.size ||
      [...keys].some((k) => !originals.has(k)) ||
      !action.title.trim() ||
      !action.artist.trim() ||
      action.title.length > 240 ||
      action.artist.length > 240 ||
      ![...keys].some((k) =>
        originals.get(k)!.some((t) => t.id === action.coverId),
      )
    )
      throw Error("Invalid album link");
    const id =
      next.albums.find((g) => g.keys.some((k) => keys.has(k)))?.id ??
      crypto.randomUUID();
    next.albums = next.albums.filter((g) => !g.keys.some((k) => keys.has(k)));
    next.albums.push({
      id,
      keys: [...keys].sort(),
      title: action.title.trim(),
      artist: action.artist.trim(),
      coverId: action.coverId,
    });
  }
  if (action.op === "albumUnlink")
    next.albums = next.albums.filter((g) => g.id !== action.id);
  if (action.op === "dismiss") {
    if (action.signature.length > 100) throw Error("Invalid signature");
    next.dismissed = [...new Set([...next.dismissed, action.signature])].slice(
      -10000,
    );
  }
  next.revision++;
  return next;
}
export interface Candidate {
  ids: [string, string];
  signature: string;
}
export function candidates(
  tracks: Track[],
  state: Organization,
): { songCandidates: Candidate[]; albumCandidates: Candidate[] } {
  const songCandidates: Candidate[] = [],
    albumCandidates: Candidate[] = [],
    buckets = new Map<string, Track[]>();
  for (const t of tracks) {
    const k = normalized(t.title) + "\u0000" + normalized(leadArtist(t)),
      g = buckets.get(k) ?? [];
    g.push(t);
    buckets.set(k, g);
  }
  for (const ts of buckets.values())
    for (let i = 0; i < ts.length; i++)
      for (let j = i + 1; j < ts.length; j++)
        if (songCandidates.length < 500 && candidateSong(ts[i], ts[j])) {
          const signature = pairSignature("songs", [ts[i]], [ts[j]]);
          if (!state.dismissed.includes(signature))
            songCandidates.push({ ids: [ts[i].id, ts[j].id], signature });
        }
  const albumBuckets = new Map<string, Array<[string, Track[]]>>();
  for (const entry of sourceAlbums(tracks)) {
    const key = normalized(albumArtist(entry[1][0])),
      bucket = albumBuckets.get(key) ?? [];
    bucket.push(entry);
    albumBuckets.set(key, bucket);
  }
  for (const albums of albumBuckets.values())
    for (let i = 0; i < albums.length; i++)
      for (let j = i + 1; j < albums.length; j++) {
        if (albumCandidates.length >= 500) break;
        const [a, ats] = albums[i],
          [b, bts] = albums[j];
        if (
          ats[0].albumIdentity?.id &&
          ats[0].albumIdentity?.id === bts[0].albumIdentity?.id
        )
          continue;
        if (candidateAlbum(ats, bts)) {
          const signature = pairSignature("albums", ats, bts);
          if (!state.dismissed.includes(signature))
            albumCandidates.push({ ids: [a, b], signature });
        }
      }
  return { songCandidates, albumCandidates };
}
