import { describe, it, expect } from "vitest";
import fixture from "../../tests/fixtures/personalized-playlists.json";
import multi from "../../tests/fixtures/multi-artist-playlists.json";
import { personalized, validFeature } from "./rank";
import { generate as legacyGenerate } from "../domain";
import type { PlaylistRequest, Track, Session } from "../types";
import type { RecommendationData } from "./types";
const now = new Date(fixture.now);
describe("personalized policy shared fixtures", () => {
  it("track feedback never changes the broader taste profile or other songs' relative order", () => {
    const request = {
      ...fixture.cases[1].request,
      targetCount: 100,
    } as PlaylistRequest;
    const normal = personalized(
      request,
      fixture.tracks,
      fixture.sessions,
      fixture.zone,
      fixture.data,
      now,
    );
    const less = personalized(
      request,
      fixture.tracks,
      fixture.sessions,
      fixture.zone,
      { ...fixture.data, less: ["t00"] },
      now,
    );
    expect(normal.recommendation.source).toBe("history");
    expect(less.recommendation.source).toBe("history");
    expect(less.ids.filter((id) => id !== "t00")).toEqual(
      normal.ids.filter((id) => id !== "t00"),
    );
  });
  for (const c of fixture.cases)
    it(c.name, () => {
      const tracks = fixture.tracks.map((t) => ({
        ...t,
        favorite:
          "favorites" in c && c.favorites === false ? false : t.favorite,
      }));
      const data = {
        ...fixture.data,
        less: "less" in c ? c.less : fixture.data.less,
      } as RecommendationData;
      const result = personalized(
        c.request as PlaylistRequest,
        tracks,
        ("sessions" in c ? c.sessions : fixture.sessions) as Session[],
        fixture.zone,
        data,
        now,
      );
      expect(result.recommendation.source).toBe(c.source);
      expect(result.ids).toHaveLength(c.count);
      expect(result.ids).toEqual(
        personalized(
          c.request as PlaylistRequest,
          tracks,
          ("sessions" in c ? c.sessions : fixture.sessions) as Session[],
          fixture.zone,
          data,
          now,
        ).ids,
      );
      expect(result.ids).toEqual(c.expectedIds);
      const artists = result.ids
        .map((id) => tracks.find((t) => t.id === id)!.artist)
        .filter(Boolean);
      for (const a of artists)
        expect(artists.filter((x) => x === a).length).toBeLessThanOrEqual(2);
    });
  it("allows an explicitly requested artist to fill the mix while general mixes remain diverse", () => {
    const tracks = fixture.tracks
      .slice(0, 5)
      .map((track) => ({ ...track, artist: "A" }));
    const request = {
      ...fixture.cases[1].request,
      targetCount: 5,
    } as PlaylistRequest;
    expect(
      personalized(
        { ...request, includeArtist: " A " },
        tracks,
        [],
        "UTC",
        fixture.data,
        now,
      ).ids,
    ).toHaveLength(5);
    expect(
      personalized(request, tracks, [], "UTC", fixture.data, now).ids,
    ).toHaveLength(2);
    expect(
      legacyGenerate(
        { ...request, includeArtist: "A" },
        tracks,
        [],
        "UTC",
        now,
      ),
    ).toHaveLength(5);
    expect(legacyGenerate(request, tracks, [], "UTC", now)).toHaveLength(2);
    expect(
      personalized(
        { ...request, includeArtist: "A", excludeArtist: "A" },
        tracks,
        [],
        "UTC",
        fixture.data,
        now,
      ).ids,
    ).toHaveLength(0);
  });
  it("shared multi-artist fixtures preserve matches, exclusions and balanced rounds", () => {
    const tracks = multi.artists.flatMap((artist, group) =>
      Array.from({ length: 3 }, (_, index) => ({
        ...fixture.tracks[0],
        id: `m${String(group * 3 + index).padStart(2, "0")}`,
        artist,
      })),
    );
    for (const c of multi.cases) {
      const request = {
        ...fixture.cases[0].request,
        ...c,
        seed: 314159,
      } as PlaylistRequest;
      const data = { less: [], features: {} };
      const result = personalized(request, tracks, [], "UTC", data, now);
      expect(result.ids, c.name).toEqual(c.expectedIds);
      expect(legacyGenerate(request, tracks, [], "UTC", now), c.name).toEqual(
        c.expectedLegacyIds,
      );
      expect(
        [
          ...new Set(
            result.ids.map((id) => tracks.find((t) => t.id === id)!.artist),
          ),
        ].sort(),
        c.name,
      ).toEqual([...c.expectedArtists].sort());
    }
  });
  it("treats genre as a preference for selected artists and a filter otherwise", () => {
    const tracks = ["Alpha", "Beta", "Gamma"].map((artist, i) => ({
      ...fixture.tracks[0], id: `genre-${i}`, artist, genre: i === 0 ? "Rock" : "Jazz",
    }));
    const request = { ...fixture.cases[0].request, includeArtist: "Alpha", includeArtists: ["Beta", "Gamma"], excludeArtist: "", genre: "Rock", targetCount: 3 } as PlaylistRequest;
    const generate = (r: PlaylistRequest) => personalized(r, tracks, [], "UTC", { less: [], features: {} }, now).ids;
    expect(new Set(generate(request))).toEqual(new Set(tracks.map(t => t.id)));
    expect(generate({ ...request, includeArtist: "", includeArtists: [] })).toEqual(["genre-0"]);
    expect(generate({ ...request, excludeArtist: "Beta" })).not.toContain("genre-1");
  });
  it("private/short/future evidence cannot change any score or seed result", () => {
    const req = fixture.cases[1].request as PlaylistRequest,
      tracks = fixture.tracks,
      data = fixture.data;
    const eligible = fixture.sessions.filter(
      (s) => !s.excluded && s.playedMs >= 30000,
    );
    expect(
      personalized(req, tracks, fixture.sessions, "UTC", data, now),
    ).toEqual(personalized(req, tracks, eligible, "UTC", data, now));
  });
  it("Suggest less is a nonzero soft weight, not an artist ban", () => {
    const tracks = fixture.tracks.map((t) => ({ ...t, favorite: false }));
    let normal = 0,
      less = 0;
    for (let seed = 1; seed <= 1000; seed++) {
      const req = {
        ...fixture.cases[1].request,
        targetCount: 1,
        seed: Math.imul(seed, 2654435761) >>> 0,
      } as PlaylistRequest;
      if (
        personalized(
          req,
          tracks,
          [],
          "UTC",
          { less: [], features: {} },
          now,
        ).ids.includes("t00")
      )
        normal++;
      if (
        personalized(
          req,
          tracks,
          [],
          "UTC",
          { less: ["t00"], features: {} },
          now,
        ).ids.includes("t00")
      )
        less++;
    }
    expect(less).toBeGreaterThan(0);
    expect(less).toBeLessThan(normal / 3);
  });
  it("unknown artists remain independent; unavailable, hidden and duplicates never enter", () => {
    const tracks: Track[] = Array.from({ length: 8 }, (_, i) => ({
      ...fixture.tracks[0],
      id: String(i),
      artist: "",
      favorite: false,
      hidden: i === 6,
      available: i !== 7,
    }));
    const result = personalized(
      { ...fixture.cases[1].request, targetCount: 8 } as PlaylistRequest,
      tracks,
      [],
      "UTC",
      { less: [], features: {} },
      now,
    );
    expect(new Set(result.ids).size).toBe(6);
    expect(result.ids).not.toContain("6");
    expect(result.recommendation.shortage).toBe(true);
    expect(validFeature({ version: 1 } as never)).toBe(false);
  });
});
