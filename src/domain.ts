import {
  localDate,
  localMidnight,
  dateBoundary,
  addDays,
} from "./recap/calendar";
export { localDate, localMidnight } from "./recap/calendar";
import { periodFor, bucketDates } from "./recap/periods";
import type { RecapRequest } from "./types";
import type {
  Track,
  Session,
  Interval,
  PlaylistRequest,
  Recap,
  Settings,
} from "./types";
export const key = (value: string) =>
  value.trim().normalize("NFKC").toLocaleLowerCase("en-US");
// Missing disc tags mean disc one; unnumbered tracks follow numbered tracks.
export function compareAlbumTracks(a: Track, b: Track): number {
  const positive = (n: number | null | undefined) =>
    n && n > 0 ? n : undefined;
  return (
    (positive(a.discNumber) ?? 1) - (positive(b.discNumber) ?? 1) ||
    (positive(a.trackNumber) ?? Number.MAX_SAFE_INTEGER) -
      (positive(b.trackNumber) ?? Number.MAX_SAFE_INTEGER) ||
    a.title.localeCompare(b.title) ||
    a.id.localeCompare(b.id)
  );
}
export function compareCatalogTracks(
  a: Track,
  b: Track,
  sort: "title" | "artist" | "album",
): number {
  if (sort === "title")
    return a.title.localeCompare(b.title) || a.id.localeCompare(b.id);
  return (
    a[sort].localeCompare(b[sort]) ||
    (sort === "album"
      ? a.artist.localeCompare(b.artist)
      : a.album.localeCompare(b.album)) ||
    compareAlbumTracks(a, b)
  );
}
export function hash(value: string): string {
  let h = 2166136261;
  for (const c of value) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return (h >>> 0).toString(16).padStart(8, "0");
}
export function coverSvg(identity: string, size = 512): string {
  const n = parseInt(hash("cover-v1:" + identity), 16);
  const palettes = [
    ["#f0e8d8", "#ee5b12", "#212b34", "#607b8c"],
    ["#17242c", "#e86821", "#e7dbc4", "#456f88"],
    ["#e9e5d8", "#3f697a", "#ed6a2b", "#29383e"],
    ["#221f22", "#c9baa0", "#ed6219", "#657371"],
  ];
  const p = palettes[n % palettes.length];
  const cx = 110 + (n % 180),
    cy = 140 + ((n >>> 8) % 210),
    r = 85 + (n % 70);
  return (
    '<svg xmlns="http://www.w3.org/2000/svg" width="' +
    size +
    '" height="' +
    size +
    '" viewBox="0 0 512 512"><rect width="512" height="512" fill="' +
    p[0] +
    '"/><circle cx="' +
    cx +
    '" cy="' +
    cy +
    '" r="' +
    r +
    '" fill="' +
    p[1] +
    '"/><path d="M0 390 L512 230 V512 H0Z" fill="' +
    p[2] +
    '"/><circle cx="398" cy="112" r="37" fill="' +
    p[3] +
    '"/><g fill="none" stroke="' +
    p[3] +
    '" stroke-width="2"><path d="M64 30V470 M90 64V480 M24 110L490 380"/><circle cx="' +
    cx +
    '" cy="' +
    cy +
    '" r="' +
    (r + 22) +
    '"/></g><rect x="373" y="330" width="8" height="101" fill="' +
    p[1] +
    '"/></svg>'
  );
}
export const coverUrl = (
  track: Pick<Track, "id" | "artist" | "album" | "artworkUrl">,
) =>
  track.artworkUrl ||
  "data:image/svg+xml;charset=utf-8," +
    encodeURIComponent(
      coverSvg(track.album ? key(track.artist + "|" + track.album) : track.id),
    );
export function generate(
  request: PlaylistRequest,
  tracks: Track[],
  sessions: Session[],
  timeZone: string,
  now = new Date(),
): string[] {
  const excluded = new Set(
      [request.excludeArtist, ...(request.excludeArtists ?? [])]
        .map(key)
        .filter(Boolean),
    ),
    included = new Set(
      [request.includeArtist, ...(request.includeArtists ?? [])]
        .map(key)
        .filter(Boolean),
    ),
    genre = key(request.genre);
  const today = localDate(now, timeZone);
  const heard = new Set(
    sessions
      .filter((s) => localDate(new Date(s.startedAtUtc), timeZone) === today)
      .map((s) => s.trackId),
  );
  let pool = tracks.filter(
    (t) =>
      t.available &&
      !t.hidden &&
      !excluded.has(key(t.artist)) &&
      (!included.size || included.has(key(t.artist))) &&
      (!genre || key(t.genre).split(/[;,/]/).map(key).includes(genre)) &&
      (!request.avoidHeardToday || !heard.has(t.id)),
  );
  pool.sort(
    (a, b) =>
      (request.preferFavorites ? Number(b.favorite) - Number(a.favorite) : 0) ||
      a.id.localeCompare(b.id),
  );
  if (included.size > 1) {
    const ranks = new Map<string, number>();
    const ranked = pool
      .map((track, order) => {
        const artist = key(track.artist),
          round = ranks.get(artist) ?? 0;
        ranks.set(artist, round + 1);
        return { track, order, round };
      })
      .sort((a, b) => a.round - b.round || a.order - b.order);
    pool = ranked.map((item) => item.track);
  }
  const out: string[] = [];
  const counts = new Map<string, number>();
  let ms = 0;
  const budget = request.targetMinutes
    ? request.targetMinutes * 60000
    : Infinity;
  const max = request.targetCount ?? 100;
  for (const t of pool) {
    if (out.length >= max) break;
    if (
      !included.size &&
      key(t.artist) &&
      (counts.get(key(t.artist)) ?? 0) >= 2
    )
      continue;
    if (
      ms + t.durationMs > budget ||
      (budget !== Infinity && t.durationMs <= 0)
    )
      continue;
    out.push(t.id);
    ms += t.durationMs;
    counts.set(key(t.artist), (counts.get(key(t.artist)) ?? 0) + 1);
  }
  return out;
}
export function aggregate(
  request: RecapRequest,
  settings: Settings,
  tracks: Track[],
  sessions: Session[],
  intervals: Interval[],
  now = new Date(),
): Recap {
  const period = periodFor(request),
    edges = bucketDates(period);
  const start = dateBoundary(period.startDate, settings.timeZone),
    end = dateBoundary(period.endDate, settings.timeZone);
  if (start > now.getTime()) throw new Error("Future recap period");
  const through = Math.max(start, Math.min(end, now.getTime()));
  const from = Math.min(
    through,
    Math.max(start, Date.parse(settings.historyEnabledSince)),
  );
  const coveredFrom = new Date(from).toISOString(),
    coveredThrough = new Date(through).toISOString();
  const boundaries = edges.map((d) => dateBoundary(d, settings.timeZone));
  const buckets = edges.slice(0, -1).map((startDate, i) => ({
    startDate,
    endDate: edges[i + 1],
    listenedMs: 0,
    observed:
      from < boundaries[i + 1] &&
      through > boundaries[i] &&
      through > from &&
      boundaries[i + 1] > boundaries[i],
  }));
  const allowed = new Set(sessions.filter((s) => !s.excluded).map((s) => s.id));
  const days = new Set<string>();
  let total = 0;
  for (const i of intervals) {
    if (!allowed.has(i.sessionId) || i.playedMs <= 0) continue;
    const a = Date.parse(i.startUtc),
      b = a + i.playedMs;
    for (let m = 0; m < buckets.length; m++) {
      const l = Math.max(a, boundaries[m], from),
        r = Math.min(b, boundaries[m + 1], through);
      if (r > l) {
        buckets[m].listenedMs += r - l;
        total += r - l;
        let d = localDate(new Date(l), settings.timeZone);
        const last = localDate(new Date(r - 1), settings.timeZone);
        while (d <= last) {
          const next = addDays(d, 1);
          if (
            dateBoundary(d, settings.timeZone) <
            dateBoundary(next, settings.timeZone)
          )
            days.add(d);
          d = next;
        }
      }
    }
  }
  const counts = new Map<string, { plays: number; playedMs: number }>();
  for (const s of sessions) {
    const t = Date.parse(s.startedAtUtc);
    if (
      !s.excluded &&
      s.playedMs >= 30000 &&
      t >= from &&
      t < end &&
      t <= now.getTime()
    ) {
      const c = counts.get(s.trackId) ?? { plays: 0, playedMs: 0 };
      c.plays++;
      c.playedMs += s.playedMs;
      counts.set(s.trackId, c);
    }
  }
  const topTracks = tracks
    .filter((t) => counts.has(t.id))
    .map((track) => ({ track, ...counts.get(track.id)! }))
    .sort(
      (a, b) =>
        b.plays - a.plays ||
        b.playedMs - a.playedMs ||
        a.track.id.localeCompare(b.track.id),
    );
  const artists = new Map<string, { name: string; plays: number }>(),
    albums = new Map<
      string,
      { name: string; artist: string; plays: number; trackId?: string }
    >();
  for (const x of topTracks) {
    const ak = key(x.track.artist) || "unknown";
    const a = artists.get(ak) ?? {
      name: x.track.artist || "Unknown artist",
      plays: 0,
    };
    a.plays += x.plays;
    artists.set(ak, a);
    if (x.track.album) {
      const bk = key(x.track.artist + "|" + x.track.album);
      const b = albums.get(bk) ?? {
        name: x.track.album,
        artist: x.track.artist,
        plays: 0,
        trackId: x.track.id,
      };
      b.plays += x.plays;
      albums.set(bk, b);
    }
  }
  const rank = <T extends { name: string; artist?: string; plays: number }>(
    m: Map<string, T>,
  ) =>
    [...m.values()]
      .sort(
        (a, b) =>
          b.plays - a.plays ||
          key(a.name).localeCompare(key(b.name)) ||
          key(a.artist ?? "").localeCompare(key(b.artist ?? "")),
      )
      .slice(0, 3);
  const available = topTracks.filter(
    (t) => t.track.available && !t.track.hidden,
  );
  const cap = available.length < 10 ? Infinity : 2;
  const artistCounts = new Map<string, number>();
  const ids = available
    .filter((x) => {
      const k = key(x.track.artist),
        c = artistCounts.get(k) ?? 0;
      if (c >= cap) return false;
      artistCounts.set(k, c + 1);
      return true;
    })
    .slice(0, 25)
    .map((x) => x.track.id);
  return {
    schemaVersion: 2,
    privacyRevision: settings.privacyRevision ?? 0,
    period,
    timeZone: settings.timeZone,
    coveredFrom,
    coveredThrough,
    completePeriod:
      now.getTime() >= end && Date.parse(settings.historyEnabledSince) <= start,
    listenedMs: total,
    qualifiedPlays: topTracks.reduce((s, t) => s + t.plays, 0),
    activeDays: days.size,
    buckets,
    topTracks,
    topArtists: rank(artists),
    topAlbums: rank(albums),
    topArtist: rank(artists)[0],
    topAlbum: rank(albums)[0],
    trackIds: ids,
    visualSeed: hash(
      period.kind + "|" + period.startDate + "|" + coveredFrom + "|" + total,
    ),
  };
}
export function recapYears(settings: Settings, now = new Date()): number[] {
  const current = Number(localDate(now, settings.timeZone).slice(0, 4));
  const since = Number(
    localDate(new Date(settings.historyEnabledSince), settings.timeZone).slice(
      0,
      4,
    ),
  );
  const first = Math.min(current, since);
  return Array.from({ length: current - first + 1 }, (_, i) => current - i);
}
export function coverageThrough(recap: Recap): Date {
  const end = dateBoundary(recap.period.endDate, recap.timeZone);
  const through = Date.parse(recap.coveredThrough);
  return new Date(
    through >= end && through > Date.parse(recap.coveredFrom)
      ? end - 1
      : through,
  );
}
export function safeRecap(recap: Recap) {
  return {
    schemaVersion: recap.schemaVersion,
    period: recap.period,
    timeZone: recap.timeZone,
    coverage: {
      since: localDate(new Date(recap.coveredFrom), recap.timeZone),
      through: localDate(coverageThrough(recap), recap.timeZone),
      completePeriod: recap.completePeriod,
    },
    minutesListened: Math.round(recap.listenedMs / 60000),
    qualifiedPlays: recap.qualifiedPlays,
    activeDays: recap.activeDays,
    buckets: recap.buckets.map((b) => ({
      startDate: b.startDate,
      endDate: b.endDate,
      minutes: Math.round(b.listenedMs / 60000),
      observed: b.observed,
    })),
    topTracks: recap.topTracks.map(({ track, plays }) => ({
      title: track.title,
      artist: track.artist,
      album: track.album,
      plays,
    })),
    topArtists: recap.topArtists,
    topAlbums: recap.topAlbums?.map(({ name, artist, plays }) => ({
      name,
      artist,
      plays,
    })),
    topArtist: recap.topArtist,
    topAlbum: recap.topAlbum
      ? {
          name: recap.topAlbum.name,
          artist: recap.topAlbum.artist,
          plays: recap.topAlbum.plays,
        }
      : undefined,
    visualSeed: recap.visualSeed,
  };
}
