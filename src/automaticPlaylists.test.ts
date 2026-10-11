import { describe, expect, it } from "vitest";
import fixture from "../tests/fixtures/automatic-playlists.json";
import { automaticPlaylists } from "./automaticPlaylists";
describe("automatic playlists", () => {
  it("matches native ordering, resumed activity and privacy fixtures", () => {
    const lists = automaticPlaylists(
      fixture.tracks,
      fixture.sessions,
      fixture.intervals,
      fixture.addedIds,
    );
    expect(lists.map((p) => p.trackIds)).toEqual(fixture.expected);
    expect(new Set(lists.map((p) => p.id)).size).toBe(4);
    expect(lists.every((p) => p.kind === "automatic")).toBe(true);
  });
  it("keeps all four empty collections and bounds recent additions", () => {
    expect(automaticPlaylists([], [], [], []).map((p) => p.trackIds)).toEqual([
      [],
      [],
      [],
      [],
    ]);
    const tracks = Array.from({ length: 110 }, (_, i) => ({
      ...fixture.tracks[0],
      id: String(i),
    }));
    expect(
      automaticPlaylists(
        tracks,
        [],
        [],
        tracks.map((t) => t.id),
      )[0].trackIds,
    ).toHaveLength(100);
  });
});
