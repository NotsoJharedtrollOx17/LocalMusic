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
export function localDate(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  return ["year", "month", "day"]
    .map((k) => parts.find((p) => p.type === k)!.value)
    .join("-");
}
export function localMidnight(
  year: number,
  month: number,
  day: number,
  timeZone: string,
): number {
  const target = Date.UTC(year, month, day);
  let t = target;
  for (let i = 0; i < 4; i++) {
    const ps = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
      hourCycle: "h23",
    }).formatToParts(new Date(t));
    const v = (k: string) => Number(ps.find((p) => p.type === k)!.value);
    const asUtc = Date.UTC(
      v("year"),
      v("month") - 1,
      v("day"),
      v("hour"),
      v("minute"),
      v("second"),
    );
    const next = t + (target - asUtc);
    if (next === t) break;
    t = next;
  }
  return t;
}
export function generate(
  request: PlaylistRequest,
  tracks: Track[],
  sessions: Session[],
  timeZone: string,
  now = new Date(),
): string[] {
  const excluded = key(request.excludeArtist),
    included = key(request.includeArtist),
    genre = key(request.genre);
  const today = localDate(now, timeZone);
  const heard = new Set(
    sessions
      .filter((s) => localDate(new Date(s.startedAtUtc), timeZone) === today)
      .map((s) => s.trackId),
  );
  const pool = tracks.filter(
    (t) =>
      t.available &&
      (!excluded || key(t.artist) !== excluded) &&
      (!included || key(t.artist) === included) &&
      (!genre || key(t.genre).split(/[;,/]/).map(key).includes(genre)) &&
      (!request.avoidHeardToday || !heard.has(t.id)),
  );
  pool.sort(
    (a, b) =>
      (request.preferFavorites ? Number(b.favorite) - Number(a.favorite) : 0) ||
      a.id.localeCompare(b.id),
  );
  const out: string[] = [];
  const counts = new Map<string, number>();
  let ms = 0;
  const budget = request.targetMinutes
    ? request.targetMinutes * 60000
    : Infinity;
  const max = request.targetCount ?? 100;
  for (const t of pool) {
    if (out.length >= max) break;
    if ((counts.get(key(t.artist)) ?? 0) >= 2) continue;
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
  year: number,
  settings: Settings,
  tracks: Track[],
  sessions: Session[],
  intervals: Interval[],
  now = new Date(),
): Recap {
  const start = localMidnight(year, 0, 1, settings.timeZone),
    end = localMidnight(year + 1, 0, 1, settings.timeZone);
  const monthEdges = Array.from({ length: 13 }, (_, m) =>
    localMidnight(year, m, 1, settings.timeZone),
  );
  const coveredFrom = new Date(
    Math.max(start, Date.parse(settings.historyEnabledSince)),
  ).toISOString();
  const coveredThrough = new Date(
    Math.max(start, Math.min(end, now.getTime())),
  ).toISOString();
  const allowed = new Set(sessions.filter((s) => !s.excluded).map((s) => s.id));
  const months = Array(12).fill(0) as number[];
  const days = new Set<string>();
  let total = 0;
  for (const i of intervals) {
    if (!allowed.has(i.sessionId) || i.playedMs <= 0) continue;
    const a = Date.parse(i.startUtc),
      b = a + i.playedMs;
    for (let m = 0; m < 12; m++) {
      const l = Math.max(a, monthEdges[m]),
        r = Math.min(b, monthEdges[m + 1], now.getTime());
      if (r > l) {
        months[m] += r - l;
        total += r - l;
        let d = l;
        while (d < r) {
          days.add(localDate(new Date(d), settings.timeZone));
          d += 3600000;
        }
        days.add(localDate(new Date(r - 1), settings.timeZone));
      }
    }
  }
  const counts = new Map<string, { plays: number; playedMs: number }>();
  for (const s of sessions) {
    const t = Date.parse(s.startedAtUtc);
    if (
      !s.excluded &&
      s.playedMs >= 30000 &&
      t >= start &&
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
    albums = new Map<string, { name: string; artist: string; plays: number }>();
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
      };
      b.plays += x.plays;
      albums.set(bk, b);
    }
  }
  const rank = <T extends { name: string; plays: number }>(m: Map<string, T>) =>
    [...m.values()].sort(
      (a, b) => b.plays - a.plays || key(a.name).localeCompare(key(b.name)),
    )[0];
  const available = topTracks.filter((t) => t.track.available);
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
    schemaVersion: 1,
    privacyRevision: settings.privacyRevision ?? 0,
    year,
    timeZone: settings.timeZone,
    coveredFrom,
    coveredThrough,
    completeYear:
      now.getTime() >= end && Date.parse(settings.historyEnabledSince) <= start,
    listenedMs: total,
    qualifiedPlays: topTracks.reduce((s, t) => s + t.plays, 0),
    activeDays: days.size,
    months,
    topTracks,
    topArtist: rank(artists),
    topAlbum: rank(albums),
    trackIds: ids,
    visualSeed: hash(year + "|" + coveredFrom + "|" + total),
  };
}
export function safeRecap(recap: Recap) {
  return {
    schemaVersion: recap.schemaVersion,
    year: recap.year,
    timeZone: recap.timeZone,
    coverage: {
      since: localDate(new Date(recap.coveredFrom), recap.timeZone),
      through: localDate(new Date(recap.coveredThrough), recap.timeZone),
      completeYear: recap.completeYear,
    },
    minutesListened: Math.round(recap.listenedMs / 60000),
    qualifiedPlays: recap.qualifiedPlays,
    activeDays: recap.activeDays,
    months: recap.months.map((ms) => Math.round(ms / 60000)),
    topTracks: recap.topTracks.map(({ track, plays }) => ({
      title: track.title,
      artist: track.artist,
      album: track.album,
      plays,
    })),
    topArtist: recap.topArtist,
    topAlbum: recap.topAlbum,
    visualSeed: recap.visualSeed,
  };
}
