import { key, localDate } from "../domain";
import type { PlaylistRequest, Session, Track } from "../types";
import type {
  AcousticFeature,
  MixRecommendation,
  RecommendationData,
} from "./types";

const day = 86400000;
const tags = (s: string) => [
  ...new Set(s.split(/[;,/]/).map(key).filter(Boolean)),
];
const compare = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
export function validFeature(
  f: AcousticFeature | undefined,
): f is AcousticFeature {
  return (
    !!f &&
    f.version === 1 &&
    Number.isFinite(f.seconds) &&
    f.seconds >= 0.1 &&
    Array.isArray(f.bands) &&
    f.bands.length === 32 &&
    f.bands.every((x) => Number.isFinite(x) && x >= 0) &&
    Math.abs(f.bands.reduce((a, b) => a + b, 0) - 1) < 0.001
  );
}
export function analysisOrder<T extends Track>(
  tracks: T[],
  sessions: Session[],
): T[] {
  const weights = new Map<string, number>();
  for (const s of sessions)
    if (!s.excluded && s.playedMs >= 30000)
      weights.set(s.trackId, (weights.get(s.trackId) ?? 0) + 1);
  const pool = tracks.filter((t) => t.available && !t.hidden && !t.demo);
  const anchors = pool
    .filter((t) => t.favorite || weights.has(t.id))
    .sort(
      (a, b) =>
        (weights.get(b.id) ?? 0) - (weights.get(a.id) ?? 0) ||
        Number(b.favorite) - Number(a.favorite) ||
        compare(a.id, b.id),
    );
  const anchored = new Set(anchors.map((t) => t.id));
  const rest = pool
    .filter((t) => !anchored.has(t.id))
    .sort((a, b) => compare(a.id, b.id));
  // Round-robin artists keeps analysis coverage from being dominated by one album.
  const groups = new Map<string, T[]>();
  for (const t of rest) {
    const k = key(t.artist) || t.id;
    const group = groups.get(k) ?? [];
    group.push(t);
    groups.set(k, group);
  }
  const out = anchors.slice(0, 32);
  const remaining = [...anchors.slice(32)];
  for (let i = 0; ; i++) {
    let added = false;
    for (const g of groups.values())
      if (g[i]) {
        remaining.push(g[i]);
        added = true;
      }
    if (!added) break;
  }
  return [...out, ...remaining];
}
export function personalized(
  request: PlaylistRequest,
  tracks: Track[],
  sessions: Session[],
  zone: string,
  data: RecommendationData,
  now = new Date(),
): { ids: string[]; recommendation: MixRecommendation } {
  if (
    (request.targetCount == null) === (request.targetMinutes == null) ||
    (request.targetCount != null &&
      (!Number.isInteger(request.targetCount) ||
        request.targetCount < 1 ||
        request.targetCount > 100)) ||
    (request.targetMinutes != null &&
      (!Number.isInteger(request.targetMinutes) ||
        request.targetMinutes < 1 ||
        request.targetMinutes > 600))
  )
    throw new Error("Playlist length is out of range");
  if (
    !request.blend ||
    !["familiar", "balanced", "explore"].includes(request.blend)
  )
    throw new Error("Invalid playlist blend");
  if (
    request.seed != null &&
    (!Number.isInteger(request.seed) ||
      request.seed < 0 ||
      request.seed > 0xffffffff)
  )
    throw new Error("Invalid generation seed");
  const eligible = sessions.filter(
    (s) =>
      !s.excluded &&
      s.playedMs >= 30000 &&
      Date.parse(s.startedAtUtc) <= +now &&
      Number.isFinite(Date.parse(s.startedAtUtc)),
  );
  const recent = eligible.filter(
    (s) => +now - Date.parse(s.startedAtUtc) <= 90 * day,
  );
  const taste = recent.length ? recent : eligible;
  const affinity = new Map<string, number>(),
    plays = new Map<string, number>(),
    last = new Map<string, number>();
  for (const s of eligible) {
    plays.set(s.trackId, (plays.get(s.trackId) ?? 0) + 1);
    last.set(
      s.trackId,
      Math.max(last.get(s.trackId) ?? 0, Date.parse(s.startedAtUtc)),
    );
  }
  for (const s of taste)
    affinity.set(
      s.trackId,
      (affinity.get(s.trackId) ?? 0) +
        Math.pow(2, -(+now - Date.parse(s.startedAtUtc)) / (30 * day)),
    );
  const positive = tracks.filter((t) => t.available && !t.hidden && !t.demo);
  const hasHistory = positive.some((t) => (affinity.get(t.id) ?? 0) > 0);
  if (!hasHistory) {
    affinity.clear();
    for (const t of positive) if (t.favorite) affinity.set(t.id, 1);
  }
  const source = hasHistory
    ? "history"
    : affinity.size
      ? "favorites"
      : "discovery";
  const anchors = positive
    .filter((t) => affinity.has(t.id))
    .sort(
      (a, b) =>
        affinity.get(b.id)! - affinity.get(a.id)! || compare(a.id, b.id),
    );
  const artists = new Map<string, number>(),
    genres = new Map<string, number>();
  const years: { year: number; weight: number }[] = [];
  for (const t of anchors) {
    const w = affinity.get(t.id)!;
    if (key(t.artist))
      artists.set(key(t.artist), (artists.get(key(t.artist)) ?? 0) + w);
    for (const g of tags(t.genre)) genres.set(g, (genres.get(g) ?? 0) + w);
    if (t.releaseYear) years.push({ year: t.releaseYear, weight: w });
  }
  const maxA = Math.max(0, ...artists.values()),
    maxG = Math.max(0, ...genres.values());
  const maxL = Math.max(0, ...affinity.values());
  const acousticAnchors: Track[] = [],
    seenArtists = new Set<string>();
  for (const t of anchors)
    if (
      validFeature(data.features[t.id]) &&
      !seenArtists.has(key(t.artist) || t.id)
    ) {
      acousticAnchors.push(t);
      seenArtists.add(key(t.artist) || t.id);
      if (acousticAnchors.length === 32) break;
    }
  for (const t of anchors)
    if (
      acousticAnchors.length < 32 &&
      validFeature(data.features[t.id]) &&
      !acousticAnchors.includes(t)
    )
      acousticAnchors.push(t);
  const today = localDate(now, zone);
  const heard = new Set(
    eligible
      .filter((s) => localDate(new Date(s.startedAtUtc), zone) === today)
      .map((s) => s.trackId),
  );
  const excluded = new Set(
    [request.excludeArtist, ...(request.excludeArtists ?? [])]
      .map(key)
      .filter(Boolean),
  );
  const included = new Set(
    [request.includeArtist, ...(request.includeArtists ?? [])]
      .map(key)
      .filter(Boolean),
  );
  const pool = tracks
    .filter(
      (t) =>
        t.available &&
        !t.hidden &&
        !excluded.has(key(t.artist)) &&
        (!included.size || included.has(key(t.artist))) &&
        (!key(request.genre) || tags(t.genre).includes(key(request.genre))) &&
        (!request.avoidHeardToday || !heard.has(t.id)),
    )
    .sort((a, b) => compare(a.id, b.id))
    .filter((t, i, all) => i === 0 || t.id !== all[i - 1].id);
  const weights =
    request.blend === "familiar"
      ? [0.4, 0.3, 0.2, 0.1]
      : request.blend === "explore"
        ? [0.1, 0.25, 0.25, 0.4]
        : [0.25, 0.3, 0.25, 0.2];
  let seed = (request.seed ?? 1) >>> 0;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return (seed + 0.5) / 4294967296;
  };
  const reasons: Record<string, string[]> = {};
  let scored = pool
    .map((t) => {
      const parts: [number, number][] = [],
        why: string[] = [];
      if (maxL > 0) {
        parts.push([
          Math.log1p(affinity.get(t.id) ?? 0) / Math.log1p(maxL),
          weights[0],
        ]);
        if (affinity.has(t.id))
          why.push(source === "favorites" ? "favorite" : "listening");
      }
      const metadata: [number, number][] = [];
      const gs = tags(t.genre);
      if (maxG && gs.length)
        metadata.push([
          Math.max(...gs.map((g) => (genres.get(g) ?? 0) / maxG)),
          0.6,
        ]);
      if (maxA && key(t.artist))
        metadata.push([(artists.get(key(t.artist)) ?? 0) / maxA, 0.3]);
      if (years.length && t.releaseYear)
        metadata.push([
          years.reduce(
            (sum, y) =>
              sum +
              y.weight * Math.exp(-Math.abs(y.year - t.releaseYear!) / 10),
            0,
          ) / years.reduce((sum, y) => sum + y.weight, 0),
          0.1,
        ]);
      if (metadata.length) {
        const m =
          metadata.reduce((s, [v, w]) => s + v * w, 0) /
          metadata.reduce((s, [, w]) => s + w, 0);
        parts.push([m, weights[1]]);
        if (m > 0.25) why.push("metadata");
      }
      const f = data.features[t.id];
      if (validFeature(f) && acousticAnchors.length) {
        const matches = acousticAnchors
          .filter((a) => a.id !== t.id)
          .map((a) =>
            data.features[a.id].bands.reduce(
              (s, v, i) => s + Math.sqrt(v * f.bands[i]),
              0,
            ),
          )
          .sort((a, b) => b - a)
          .slice(0, 3);
        if (matches.length) {
          parts.push([
            matches.reduce((a, b) => a + b, 0) / matches.length,
            weights[2],
          ]);
          why.push("sound");
        }
      }
      const count = plays.get(t.id) ?? 0;
      const fresh =
        0.5 / (1 + count) +
        0.5 *
          (last.has(t.id)
            ? Math.min(1, (+now - last.get(t.id)!) / (30 * day))
            : 1);
      parts.push([fresh, weights[3]]);
      if (fresh > 0.5) why.push("fresh");
      const score =
        (0.05 +
          parts.reduce((s, [v, w]) => s + v * w, 0) /
            parts.reduce((s, [, w]) => s + w, 0)) *
        (request.preferFavorites && t.favorite ? 1.25 : 1) *
        (data.less.includes(t.id) ? 0.1 : 1);
      if (data.less.includes(t.id)) why.push("less");
      reasons[t.id] = why;
      return { t, priority: -Math.log(random()) / score };
    })
    .sort((a, b) => a.priority - b.priority || compare(a.t.id, b.t.id));
  if (included.size > 1) {
    const ranks = new Map<string, number>();
    const ranked = scored
      .map((entry, order) => {
        const artist = key(entry.t.artist),
          round = ranks.get(artist) ?? 0;
        ranks.set(artist, round + 1);
        return { entry, order, round };
      })
      .sort((a, b) => a.round - b.round || a.order - b.order);
    scored = ranked.map((item) => item.entry);
  }
  let elapsed = 0;
  const selected: Track[] = [],
    counts = new Map<string, number>();
  for (const { t } of scored) {
    const artist = key(t.artist);
    if (selected.length >= (request.targetCount ?? 100)) break;
    if (!included.size && artist && (counts.get(artist) ?? 0) >= 2) continue;
    if (
      request.targetMinutes != null &&
      (t.durationMs <= 0 ||
        elapsed + t.durationMs > request.targetMinutes * 60000)
    )
      continue;
    selected.push(t);
    elapsed += t.durationMs;
    if (artist) counts.set(artist, (counts.get(artist) ?? 0) + 1);
  }
  const ordered: Track[] = [];
  while (selected.length) {
    let i = selected.findIndex(
      (t) =>
        !key(t.artist) || key(t.artist) !== key(ordered.at(-1)?.artist ?? ""),
    );
    if (i < 0) i = 0;
    ordered.push(selected.splice(i, 1)[0]);
  }
  const ids = ordered.map((t) => t.id);
  return {
    ids,
    recommendation: {
      source,
      analyzed: pool.filter((t) => validFeature(data.features[t.id])).length,
      total: pool.length,
      shortage:
        request.targetCount != null
          ? ids.length < request.targetCount
          : elapsed < (request.targetMinutes ?? 0) * 60000,
      reasons: Object.fromEntries(ids.map((id) => [id, reasons[id]])),
    },
  };
}
