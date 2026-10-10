import { describe, it, expect } from "vitest";
import {
  aggregate,
  generate,
  safeRecap,
  coverSvg,
  localMidnight,
  recapYears,
} from "./domain";
import type { Track, Settings, Session, Interval } from "./types";
const track = (id: string, artist = "A"): Track => ({
  id,
  title: id,
  artist,
  album: "Album",
  genre: "Rock",
  durationMs: 60000,
  sourceUri: "/private/" + id,
  favorite: false,
  available: true,
});
const settings: Settings = {
  language: "en",
  theme: "system",
  timeZone: "UTC",
  historyEnabledSince: "2025-01-01T00:00:00Z",
};
describe("recap evidence", () => {
  it("splits year-crossing time but assigns qualified plays to the start year", () => {
    const s: Session = {
      id: "s",
      trackId: "a",
      startedAtUtc: "2025-12-31T23:59:40Z",
      playedMs: 40000,
      excluded: false,
    };
    const i: Interval = {
      sessionId: "s",
      sequence: 0,
      startUtc: s.startedAtUtc,
      playedMs: 40000,
    };
    const a = aggregate(
      2025,
      settings,
      [track("a")],
      [s],
      [i],
      new Date("2026-02-01"),
    );
    const b = aggregate(
      2026,
      settings,
      [track("a")],
      [s],
      [i],
      new Date("2026-02-01"),
    );
    expect(a.listenedMs).toBe(20000);
    expect(a.qualifiedPlays).toBe(1);
    expect(b.listenedMs).toBe(20000);
    expect(b.qualifiedPlays).toBe(0);
  });
  it("includes short playing time and excludes private sessions entirely", () => {
    const ss: Session[] = [
      {
        id: "s",
        trackId: "a",
        startedAtUtc: "2025-03-01T00:00:00Z",
        playedMs: 20000,
        excluded: false,
      },
      {
        id: "p",
        trackId: "b",
        startedAtUtc: "2025-03-01T01:00:00Z",
        playedMs: 60000,
        excluded: true,
      },
    ];
    const r = aggregate(
      2025,
      settings,
      [track("a"), track("b")],
      ss,
      ss.map((s) => ({
        sessionId: s.id,
        sequence: 0,
        startUtc: s.startedAtUtc,
        playedMs: s.playedMs,
      })),
      new Date("2025-04-01"),
    );
    expect(r.listenedMs).toBe(20000);
    expect(r.qualifiedPlays).toBe(0);
    expect(r.activeDays).toBe(1);
  });
  it("resolves DST midnight boundaries", () => {
    expect(localMidnight(2025, 2, 9, "America/Los_Angeles")).toBe(
      Date.parse("2025-03-09T08:00:00Z"),
    );
    expect(
      localMidnight(2025, 2, 10, "America/Los_Angeles") -
        localMidnight(2025, 2, 9, "America/Los_Angeles"),
    ).toBe(23 * 3600000);
  });
  it("builds recap year choices in the configured time zone", () => {
    const now = new Date("2026-01-01T01:00:00Z");
    expect(recapYears(settings, now)).toEqual([2026, 2025]);
    expect(
      recapYears({ ...settings, timeZone: "America/Los_Angeles" }, now),
    ).toEqual([2025, 2024]);
  });
  it("keeps completed-year display dates inside the selected year", () => {
    for (const timeZone of ["UTC", "America/Los_Angeles"]) {
      const recap = aggregate(
        2025,
        { ...settings, timeZone },
        [],
        [],
        [],
        new Date("2026-01-02T12:00:00Z"),
      );
      expect(recap.completeYear).toBe(true);
      expect(safeRecap(recap).coverage).toMatchObject({
        since: "2025-01-01",
        through: "2025-12-31",
      });
    }
  });
  it("exports display data without paths, identifiers or exact times", () => {
    const r = aggregate(
      2025,
      settings,
      [track("a")],
      [],
      [],
      new Date("2025-01-02"),
    );
    const out = JSON.stringify(safeRecap(r));
    expect(out).not.toContain("sourceUri");
    expect(out).not.toContain("/private");
    expect(out).not.toContain("T00:");
  });
});
describe("playlist policy", () => {
  it("never relaxes exclusions, availability or duration", () => {
    const ts = [
      track("1", "A"),
      track("2", "B"),
      { ...track("3", "B"), available: false },
    ];
    expect(
      generate(
        {
          title: "Mix",
          genre: "Rock",
          includeArtist: "",
          excludeArtist: "A",
          preferFavorites: false,
          avoidHeardToday: false,
          targetMinutes: 1,
        },
        ts,
        [],
        "UTC",
      ),
    ).toEqual(["2"]);
  });
  it("caps artists and is deterministic", () => {
    const req = {
      title: "Mix",
      genre: "",
      includeArtist: "",
      excludeArtist: "",
      preferFavorites: false,
      avoidHeardToday: false,
      targetCount: 10,
    };
    expect(
      generate(req, [track("3"), track("1"), track("2")], [], "UTC"),
    ).toEqual(["1", "2"]);
  });
});
it("procedural covers remain identical for a stable identity", () => {
  expect(coverSvg("same album")).toBe(coverSvg("same album"));
  expect(coverSvg("different")).not.toBe(coverSvg("same album"));
});
