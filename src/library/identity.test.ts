import { describe, it, expect } from "vitest";
import fixture from "../../tests/fixtures/library-identity.json";
import {
  emptyOrganization,
  importedArtistNames,
  leadArtist,
  organize,
  applyOrganization,
  baseAlbumId,
  uniqueSongs,
  candidates,
  sourceAlbums,
  candidateAlbum,
  songIdentity,
} from "./identity";
import { aggregate, generate } from "../domain";
import { personalized } from "../playlists/rank";
import type { Track, Session, PlaylistRequest, Settings } from "../types";
const tracks = fixture.tracks as Track[],
  sessions = fixture.sessions as Session[];
const request: PlaylistRequest = {
  title: "Mix",
  targetCount: 30,
  genre: "",
  includeArtist: "Lead",
  excludeArtist: "",
  preferFavorites: false,
  avoidHeardToday: false,
  seed: 12,
  blend: "balanced",
};
const settings: Settings = {
  language: "en",
  theme: "light",
  timeZone: "UTC",
  historyEnabledSince: "2026-01-01T00:00:00Z",
};
const linked = () => {
  let state = applyOrganization(
    emptyOrganization(),
    { op: "songLink", ids: ["a", "b"], preferred: "b" },
    tracks,
  );
  state = applyOrganization(
    state,
    {
      op: "albumLink",
      keys: [baseAlbumId(tracks[0]), baseAlbumId(tracks[1])],
      title: "Canonical",
      artist: "Lead",
      coverId: "a",
    },
    tracks.map((t) => organize(t, state)),
  );
  return state;
};
describe("shared library identity", () => {
  it("resolves conservative lead credits and detects reviewed candidates", () => {
    for (const [id, name] of Object.entries(fixture.leads))
      expect(leadArtist(tracks.find((t) => t.id === id)!)).toBe(name);
    const ts = tracks.map((t) => organize(t, emptyOrganization())),
      found = candidates(ts, emptyOrganization());
    expect(
      found.songCandidates.some(
        (c) => c.ids.includes("a") && c.ids.includes("b"),
      ),
    ).toBe(true);
    expect(found.songCandidates.some((c) => c.ids.includes("e"))).toBe(false);
    const albums = sourceAlbums(ts);
    expect(
      candidateAlbum(
        albums.get(baseAlbumId(ts[0]))!,
        albums.get(baseAlbumId(ts[1]))!,
      ),
    ).toBe(true);
    const signature = found.songCandidates[0].signature;
    const state = applyOrganization(
      emptyOrganization(),
      { op: "dismiss", signature },
      tracks,
    );
    expect(
      candidates(ts, state).songCandidates.some(
        (c) => c.signature === signature,
      ),
    ).toBe(false);
  });
  it("links reversibly, retains raw metadata and chooses an eligible available copy", () => {
    const state = linked(),
      organized = tracks.map((t) => organize(t, state));
    expect(organized[0].artist).toBe("Lead feat. Guest");
    expect(organized[0].album).toBe("First");
    expect(organized[0].albumIdentity?.title).toBe("Canonical");
    expect(
      uniqueSongs(organized)
        .filter((t) => ["a", "b"].includes(t.id))
        .map((t) => t.id),
    ).toEqual(["b"]);
    expect(
      uniqueSongs(
        organized.map((t) => ({ ...t, available: t.id !== "b" })),
      ).some((t) => t.id === "a"),
    ).toBe(true);
    let reset = applyOrganization(
      state,
      { op: "albumUnlink", id: state.albums[0].id },
      organized,
    );
    reset = applyOrganization(
      reset,
      { op: "songUnlink", id: state.songs[0].id },
      organized,
    );
    expect(organize(tracks[0], reset).albumIdentity).toBeUndefined();
    expect(organize(tracks[0], reset).songIdentity).toBeUndefined();
  });
  it("consolidates song and album rankings from original sessions without double counts", () => {
    const linkedState = linked(),
      ts = tracks.map((t) => organize(t, linkedState));
    const r = aggregate(
      { kind: "year", anchorDate: "2026-01-01" },
      settings,
      ts,
      sessions,
      [],
      new Date("2026-02-01T00:00:00Z"),
    );
    expect(r.qualifiedPlays).toBe(2);
    expect(r.topTracks[0].track.id).toBe("b");
    expect(r.topTracks[0].plays).toBe(2);
    expect(r.topArtists![0]).toEqual({ name: "Lead", plays: 2 });
    expect(r.topAlbums![0].name).toBe("Canonical");
    expect(r.topAlbums![0].plays).toBe(2);
    const state = applyOrganization(
        emptyOrganization(),
        { op: "songLink", ids: ["a", "b"], preferred: "b" },
        tracks,
      ),
      split = aggregate(
        { kind: "year", anchorDate: "2026-01-01" },
        settings,
        tracks.map((t) => organize(t, state)),
        sessions,
        [],
        new Date("2026-02-01T00:00:00Z"),
      );
    expect(split.topAlbums!.map((a) => a.plays)).toEqual([1, 1]);
  });
  it("deduplicates after hard filters and shares history cooldowns", () => {
    const linkedState = linked(),
      ts = tracks.map((t) => organize(t, linkedState));
    for (const ids of [
      generate(request, ts, sessions, "UTC"),
      personalized(
        request,
        ts,
        sessions,
        "UTC",
        { less: [], features: {} },
        new Date("2026-01-02T18:00:00Z"),
      ).ids,
    ]) {
      expect(ids.filter((id) => ["a", "b"].includes(id))).toEqual(["b"]);
      expect(
        new Set(ids.map((id) => songIdentity(ts.find((t) => t.id === id)!)))
          .size,
      ).toBe(ids.length);
    }
    const avoided = personalized(
      { ...request, avoidHeardToday: true },
      ts,
      sessions,
      "UTC",
      { less: [], features: {} },
      new Date("2026-01-02T18:00:00Z"),
    ).ids;
    expect(avoided.some((id) => ["a", "b"].includes(id))).toBe(false);
  });
});

it("keeps album links across metadata refresh and artist corrections, and separates editions", () => {
  const original = tracks.map((t) => organize(t, emptyOrganization()));
  let state = applyOrganization(
    emptyOrganization(),
    {
      op: "albumLink",
      keys: [baseAlbumId(original[0]), baseAlbumId(original[1])],
      title: "Unified",
      artist: "Lead",
      coverId: "a",
    },
    original,
  );
  state = applyOrganization(
    state,
    { op: "artist", ids: ["a"], name: "Corrected lead" },
    original,
  );
  const updated = organize({ ...original[0], album: "Retagged name" }, state);
  expect(updated.albumIdentity?.title).toBe("Unified");
  expect(updated.album).toBe("Retagged name");
  expect(leadArtist(updated)).toBe("Corrected lead");
  const edition = tracks.filter((t) => ["a", "c"].includes(t.id)),
    remastered = edition.map((t) => ({
      ...t,
      id: t.id + "r",
      album: "First (Remastered)",
    }));
  expect(candidateAlbum(edition, remastered)).toBe(false);
});

it("indexes a 10000-track catalog without comparing unrelated artists", () => {
  const catalog = Array.from({ length: 10000 }, (_, i) => ({
    ...tracks[0],
    id: `large-${i}`,
    artist: `Artist ${i}`,
    album: `Album ${i}`,
    title: `Song ${i}`,
  }));
  const start = performance.now(),
    result = candidates(catalog, emptyOrganization());
  expect(result.songCandidates).toEqual([]);
  expect(result.albumCandidates).toEqual([]);
  expect(performance.now() - start).toBeLessThan(5000);
});

it("does not let parser-inferred ARTISTS bypass explicit featuring markers", () => {
  const t = {
    ...tracks[0],
    artistNames: importedArtistNames(tracks[0].artist, [tracks[0].artist]),
  };
  expect(leadArtist(t)).toBe("Lead");
  expect(importedArtistNames("Lead feat. Guest", ["Lead", "Guest"])).toEqual([
    "Lead",
    "Guest",
  ]);
  expect(
    leadArtist({
      ...tracks[0],
      artist: "AC/DC",
      artistNames: importedArtistNames("AC/DC", ["AC/DC"]),
    }),
  ).toBe("AC/DC");
});
