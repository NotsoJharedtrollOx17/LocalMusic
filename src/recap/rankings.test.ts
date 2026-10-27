import { expect, it } from "vitest";
import fixture from "../../tests/fixtures/recap-rankings.json";
import { recapRankings } from "./rankings";
import { aggregate, safeRecap } from "../domain";
import type { Session, Track } from "../types";

it("ranks complete artist/album totals with stable ties and excludes private plays", () => {
  const tracks: Track[] = fixture.tracks.map((x) => ({
    ...x,
    durationMs: 60000,
    sourceUri: `/private/${x.id}`,
    genre: "",
    favorite: false,
  }));
  const sessions: Session[] = fixture.tracks.flatMap((x) =>
    Array.from({ length: x.plays }, (_, i) => ({
      id: `${x.id}-${i}`,
      trackId: x.id,
      startedAtUtc: "2026-10-20T12:00:00Z",
      playedMs: 30000,
      excluded: x.excluded,
    })),
  );
  const r = aggregate(
    { kind: "week", anchorDate: "2026-10-25" },
    {
      language: "en",
      theme: "light",
      timeZone: "UTC",
      historyEnabledSince: "2026-01-01T00:00:00Z",
    },
    tracks,
    sessions,
    [],
    new Date("2026-10-25T12:00:00Z"),
  );
  expect(r.topTracks.map((x) => x.track.id)).toEqual(fixture.expected.songs);
  expect(r.topArtists?.map((x) => x.name)).toEqual(fixture.expected.artists);
  expect(r.topAlbums?.map((x) => [x.name, x.artist])).toEqual(
    fixture.expected.albums,
  );
  expect(r.topAlbums?.map((x) => x.trackId)).toEqual(["a", "c", "b"]);
  expect(JSON.stringify(safeRecap(r))).not.toContain("trackId");
  const groups = recapRankings(r);
  expect(groups.map((group) => group.key)).toEqual([
    "songs",
    "artists",
    "albums",
  ]);
  expect(groups[0].items.map((item) => item.name)).toEqual(
    r.topTracks.slice(0, 3).map((item) => item.track.title),
  );
  expect(groups[2].items.map((item) => item.artwork?.id)).toEqual([
    "a",
    "c",
    "b",
  ]);
  const legacy = recapRankings({
    ...r,
    topArtists: undefined,
    topAlbums: undefined,
  });
  expect(legacy[1].items).toHaveLength(1);
  expect(legacy[2].items).toHaveLength(1);
  const missing = recapRankings({
    ...r,
    topTracks: [],
    topAlbums: [{ name: "Missing album", artist: "Missing artist", plays: 3 }],
  });
  expect(missing[2].items[0].artwork).toMatchObject({
    album: "Missing album",
    artist: "Missing artist",
    sourceUri: "",
  });
  expect(r.topArtist).toEqual(r.topArtists?.[0]);
  expect(r.topAlbum).toEqual(r.topAlbums?.[0]);
  expect(JSON.stringify(safeRecap(r))).not.toContain("/private/");
  expect(JSON.stringify(safeRecap(r))).not.toContain("Private Song");
});
