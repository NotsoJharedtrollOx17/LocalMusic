import { describe, it, expect } from "vitest";
import fixture from "../../tests/fixtures/acoustic-analysis.json";
import { AcousticAnalysis, excerptRanges } from "./acoustic";
describe("source acoustic fixtures", () => {
  for (const c of fixture.cases)
    it(c.name, () => {
      const a = new AcousticAnalysis();
      const channels = c.frequencies.map((f, i) => {
        let seed = 17;
        return Float32Array.from({ length: 16384 }, (_, n) => {
          if (f === -1) {
            seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
            return (seed / 4294967296 - 0.5) * 0.2;
          }
          if (f === -2) return n === 9216 ? 0.2 : 0;
          return c.phases[i] * 0.2 * Math.sin((2 * Math.PI * n * f) / c.rate);
        });
      });
      a.add(channels, c.rate);
      const feature = a.finish("fixture");
      if (c.name === "silence") {
        expect(feature).toBeNull();
        return;
      }
      expect(feature).not.toBeNull();
      expect(feature!.bands.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 8);
      if ("expectedBands" in c)
        feature!.bands.forEach((v, i) =>
          expect(v).toBeCloseTo(c.expectedBands![i], 7),
        );
      if (c.dominant != null)
        expect(
          Math.abs(
            feature!.bands.indexOf(Math.max(...feature!.bands)) - c.dominant,
          ),
        ).toBeLessThanOrEqual(1);
      if (c.name === "inverted") {
        const mono = new AcousticAnalysis();
        mono.add([channels[0]], c.rate);
        const expected = mono.finish("fixture")!;
        feature!.bands.forEach((b, i) =>
          expect(b).toBeCloseTo(expected.bands[i], 10),
        );
      }
    });
  it("bounds non-overlapping excerpts", () => {
    for (const d of [1, 10, 24, 25, 40, 300]) {
      const ranges = excerptRanges(d);
      expect(
        ranges.reduce((sum, [a, b]) => sum + b - a, 0),
      ).toBeLessThanOrEqual(24);
      for (let i = 0; i < ranges.length; i++) {
        expect(ranges[i][0]).toBeGreaterThanOrEqual(i ? ranges[i - 1][1] : 0);
        expect(ranges[i][1]).toBeLessThanOrEqual(d);
      }
    }
  });
});
