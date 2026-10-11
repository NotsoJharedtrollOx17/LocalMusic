import type { Track, Session, Interval, Playlist } from "./types";
const compare = (a: string, b: string) => {
  const left = Array.from(a, (c) => c.codePointAt(0)!),
    right = Array.from(b, (c) => c.codePointAt(0)!);
  for (let i = 0; i < Math.min(left.length, right.length); i++)
    if (left[i] !== right[i]) return left[i] - right[i];
  return left.length - right.length;
};
const key = (value: string) => value.trim().normalize("NFKC").toLowerCase();

/** Browser counterpart of music_core::automatic_playlists. */
export function automaticPlaylists(
  tracks: Track[],
  sessions: Session[],
  intervals: Interval[],
  addedIds: string[],
): Playlist[] {
  const visible = new Map(
    tracks.filter((t) => t.available && !t.hidden).map((t) => [t.id, t]),
  );
  const eligible = new Map(
    sessions
      .filter(
        (s) =>
          !s.excluded &&
          s.playedMs > 0 &&
          visible.has(s.trackId) &&
          !visible.get(s.trackId)!.demo,
      )
      .map((s) => [s.id, s]),
  );
  const recent = new Map<string, number>(),
    plays = new Map<string, { count: number; ms: number }>();
  for (const s of eligible.values()) {
    const time = Date.parse(s.startedAtUtc);
    if (Number.isFinite(time))
      recent.set(s.trackId, Math.max(recent.get(s.trackId) ?? -Infinity, time));
    if (s.playedMs >= 30000) {
      const p = plays.get(s.trackId) ?? { count: 0, ms: 0 };
      p.count++;
      p.ms += s.playedMs;
      plays.set(s.trackId, p);
    }
  }
  for (const i of intervals) {
    const session = eligible.get(i.sessionId),
      start = Date.parse(i.startUtc);
    if (session && i.playedMs > 0 && Number.isFinite(start))
      recent.set(
        session.trackId,
        Math.max(recent.get(session.trackId) ?? -Infinity, start + i.playedMs),
      );
  }
  const titleOrder = (a: string, b: string) =>
    compare(key(visible.get(a)!.title), key(visible.get(b)!.title)) ||
    compare(a, b);
  const played = [...recent.keys()]
    .sort((a, b) => recent.get(b)! - recent.get(a)! || titleOrder(a, b))
    .slice(0, 100);
  const most = [...plays.keys()]
    .sort(
      (a, b) =>
        plays.get(b)!.count - plays.get(a)!.count ||
        plays.get(b)!.ms - plays.get(a)!.ms ||
        (recent.get(b) ?? 0) - (recent.get(a) ?? 0) ||
        titleOrder(a, b),
    )
    .slice(0, 100);
  const favorites = [...visible.values()]
    .filter((t) => t.favorite)
    .map((t) => t.id)
    .sort(titleOrder);
  return [
    [
      "recently-added",
      "Recently added",
      addedIds.filter((id) => visible.has(id)).slice(0, 100),
    ],
    ["recently-played", "Recently played", played],
    ["most-played", "Most played", most],
    ["favorites", "Favorites", favorites],
  ].map(([id, title, trackIds]) => ({
    id: `automatic:${id}`,
    title: title as string,
    kind: "automatic",
    trackIds: trackIds as string[],
  }));
}
