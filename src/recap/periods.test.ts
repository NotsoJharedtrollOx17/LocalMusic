import { describe, it, expect } from "vitest";
import fixtures from "../../tests/fixtures/recap-periods.json";
import { aggregate, safeRecap } from "../domain";
import {
  normalizeRecap,
  periodFor,
  periodOptions,
  bucketLabel,
} from "./periods";
import type { RecapKind, Track, Settings } from "../types";
const track: Track = {
  id: "a",
  title: "Song",
  artist: "Artist",
  album: "Album",
  genre: "",
  durationMs: 60000,
  sourceUri: "/private/audio.mp3",
  favorite: false,
  available: true,
};
const settings: Settings = {
  language: "en",
  theme: "system",
  timeZone: "UTC",
  historyEnabledSince: "2020-01-01T00:00:00Z",
};
describe("shared calendar aggregation", () => {
  for (const f of fixtures)
    it(f.name, () => {
      const session = {
        id: "s",
        trackId: "a",
        startedAtUtc: f.start,
        playedMs: f.playedMs,
        excluded: f.excluded ?? false,
      };
      const r = aggregate(
        { ...f.request, kind: f.request.kind as RecapKind },
        { ...settings, timeZone: f.timeZone, historyEnabledSince: f.history },
        [track],
        [session],
        [
          {
            sessionId: "s",
            sequence: 0,
            startUtc: f.start,
            playedMs: f.playedMs,
          },
        ],
        new Date(f.now),
      );
      expect(r.period).toEqual({
        kind: f.request.kind,
        startDate: f.expected.startDate,
        endDate: f.expected.endDate,
      });
      expect(r).toMatchObject({
        listenedMs: f.expected.listenedMs,
        activeDays: f.expected.activeDays,
        qualifiedPlays: f.expected.qualifiedPlays,
      });
      expect(r.buckets).toHaveLength(f.expected.bucketCount);
      expect(r.buckets.filter((b) => b.observed)).toHaveLength(
        f.expected.observedCount,
      );
      expect(r.buckets.reduce((s, b) => s + b.listenedMs, 0)).toBe(
        r.listenedMs,
      );
      expect(Date.parse(r.coveredFrom)).toBeLessThanOrEqual(
        Date.parse(r.coveredThrough),
      );
      expect(JSON.stringify(safeRecap(r))).not.toMatch(
        /sourceUri|\/private\/|sessionId|T\d\d:/,
      );
    });
  it("rejects invalid, unsupported and future requests", () => {
    for (const date of ["2025-02-29", "2026-13-01", "not-a-date"])
      expect(() => periodFor({ kind: "month", anchorDate: date })).toThrow();
    expect(() =>
      periodFor({ kind: "fortnight" as RecapKind, anchorDate: "2026-01-01" }),
    ).toThrow();
    expect(() =>
      aggregate(
        { kind: "month", anchorDate: "2099-01-01" },
        settings,
        [],
        [],
        [],
        new Date("2026-01-01"),
      ),
    ).toThrow(/Future/);
  });
  it("projects legacy snapshots without changing stored values", () => {
    const old = {
      schemaVersion: 1,
      year: 2025,
      timeZone: "UTC",
      coveredFrom: "2025-01-01T00:00:00Z",
      coveredThrough: "2026-01-01T00:00:00Z",
      completeYear: true,
      months: Array(12).fill(0),
      listenedMs: 0,
      qualifiedPlays: 0,
      activeDays: 0,
      topTracks: [],
      trackIds: [],
      visualSeed: "original",
    };
    const before = JSON.stringify(old),
      r = normalizeRecap(old);
    expect(r.period).toEqual({
      kind: "year",
      startDate: "2025-01-01",
      endDate: "2026-01-01",
    });
    expect(r.visualSeed).toBe("original");
    expect(r.completePeriod).toBe(true);
    expect(JSON.stringify(old)).toBe(before);
    expect(normalizeRecap(r)).toEqual(r);
  });
  it("offers only intersecting past/current periods and sparse monthly labels", () => {
    const s = { ...settings, historyEnabledSince: "2026-01-01T12:00:00Z" };
    const options = periodOptions("week", s, new Date("2026-01-14T00:00:00Z"));
    expect(options.map((p) => p.startDate)).toEqual([
      "2026-01-12",
      "2026-01-05",
      "2025-12-29",
    ]);
    const r = aggregate(
      { kind: "month", anchorDate: "2026-01-01" },
      s,
      [],
      [],
      [],
      new Date("2026-02-01"),
    );
    expect(r.buckets.map((_, i) => bucketLabel(r, i)).filter(Boolean)).toEqual([
      "1",
      "5",
      "10",
      "15",
      "20",
      "25",
      "31",
    ]);
  });
});
