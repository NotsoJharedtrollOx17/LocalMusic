import { key } from "../domain";
import type { Recap, Track } from "../types";

export interface RankingItem {
  name: string;
  detail: string;
  plays: number;
  artwork?: Track;
}
export interface RankingGroup {
  key: "songs" | "artists" | "albums";
  titleKey: "topSongs" | "topArtists" | "topAlbums";
  items: RankingItem[];
}

export function recapRankings(
  recap: Recap,
  cache: Record<string, Track> = {},
): RankingGroup[] {
  return [
    {
      key: "songs",
      titleKey: "topSongs",
      items: recap.topTracks.slice(0, 3).map(({ track, plays }) => ({
        name: track.title,
        detail: track.artist,
        plays,
        artwork: cache[track.id] ?? track,
      })),
    },
    {
      key: "artists",
      titleKey: "topArtists",
      items: (recap.topArtists?.length
        ? recap.topArtists
        : recap.topArtist
          ? [recap.topArtist]
          : []
      )
        .slice(0, 3)
        .map((x) => ({ name: x.name, plays: x.plays, detail: "" })),
    },
    {
      key: "albums",
      titleKey: "topAlbums",
      items: (recap.topAlbums?.length
        ? recap.topAlbums
        : recap.topAlbum
          ? [recap.topAlbum]
          : []
      )
        .slice(0, 3)
        .map((x) => ({
          name: x.name,
          detail: x.artist,
          plays: x.plays,
          artwork: (x.trackId ? cache[x.trackId] : undefined) ??
            recap.topTracks.find((t) =>
              x.trackId
                ? t.track.id === x.trackId
                : key(t.track.album) === key(x.name) &&
                  key(t.track.artist) === key(x.artist),
            )?.track ?? {
              id: x.trackId ?? `recap-album:${x.artist}:${x.name}`,
              title: x.name,
              artist: x.artist,
              album: x.name,
              genre: "",
              sourceUri: "",
              durationMs: 0,
              available: false,
              favorite: false,
            },
        })),
    },
  ];
}
