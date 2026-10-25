import { describe, it, expect, vi, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { coefficients, response, bank, headroom, SoundProcessor } from "./dsp";
import { defaultSound, validateSound, effectiveCurves } from "./model";
import normalization from "../../tests/fixtures/sound-normalization.json";
import type { SoundConfig } from "./types";
import { saveCustom, selectSoundPreset } from "./model";
import { formatGain } from "./formatGain";
afterEach(() => vi.restoreAllMocks());
describe("shared sound processing", () => {
  it("matches shared legacy normalization fixtures", () => {
    for (const sample of normalization) {
      expect(validateSound(sample.input as SoundConfig), sample.name).toEqual(
        sample.expected,
      );
    }
  });
  it("keeps Custom edits when switching to Normal or another preset", () => {
    const edited = saveCustom(defaultSound(), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    const normal = selectSoundPreset(edited, "flat");
    expect(normal.gains).toEqual(Array(10).fill(0));
    const rock = selectSoundPreset(normal, "rock");
    expect(selectSoundPreset(rock, "custom").gains).toEqual(edited.gains);
    expect(validateSound(normal).presets).toEqual(edited.presets);
  });
  it("formats zero without a sign, including rounded attenuation and negative zero", () => {
    for (const value of [0, -0, -0.01, 0.01])
      expect(formatGain(value)).toBe("0.0 dB");
    expect(formatGain(1)).toBe("+1.0 dB");
    expect(formatGain(-1)).toBe("-1.0 dB");
  });
  it("matches independent RBJ fixtures, including Nyquist", () => {
    const rows = readFileSync(
      new URL("../../tests/fixtures/sound-dsp.csv", import.meta.url),
      "utf8",
    )
      .trim()
      .split("\n")
      .slice(1);
    for (const row of rows) {
      const [rate, f, g, ...expected] = row.split(",").map(Number);
      coefficients(f, g, rate).forEach((x, i) =>
        expect(x).toBeCloseTo(expected[i], 10),
      );
    }
    expect(response(coefficients(1000, 6, 48000), 1000, 48000)).toBeCloseTo(
      6,
      8,
    );
  });
  it("validates persistence and rejects nonfinite, excessive and duplicate controls", () => {
    expect(validateSound(defaultSound()).enabled).toBe(true);
    expect(validateSound({ ...defaultSound(), preamp: 12 }).preamp).toBe(0);
    expect(() => validateSound({ ...defaultSound(), preamp: 12.5 })).toThrow();
    expect(() =>
      validateSound({ ...defaultSound(), gains: Array(10).fill(NaN) }),
    ).toThrow();
    expect(() =>
      validateSound({
        ...defaultSound(),
        presets: [
          {
            id: "rock",
            name: "Overwrite",
            gains: Array(10).fill(0),
            preamp: 0,
          },
        ],
      }),
    ).toThrow();
  });
  it("has true bypass, finite crossfades and a linked peak limiter", () => {
    const dsp = new SoundProcessor(48000);
    expect(dsp.process([0.99, -0.8])).toEqual([0.99, -0.8]);
    dsp.configure(
      bank([Array(10).fill(0), Array(10).fill(0)], 48000),
      20,
      false,
    );
    for (let i = 0; i < 2000; i++) {
      const [l, r] = dsp.process([1, 0.5]);
      expect(Math.abs(l)).toBeLessThanOrEqual(10 ** (-1 / 20) + 1e-9);
      expect(l / r).toBeCloseTo(2, 8);
    }
    dsp.configure(bank([Array(10).fill(0), Array(10).fill(0)], 48000), 1, true);
    for (let i = 0; i < 1000; i++) dsp.process([0, 0]);
    expect(dsp.process([0.99, -0.8])).toEqual([0.99, -0.8]);
  });
  it("adds headroom and applies the same ordinary curve to both channels", () => {
    const config = saveCustom(defaultSound(), [0, 0, 0, 0, 0, 6, 0, 0, 0, 0]);
    const curves = effectiveCurves(config);
    expect(curves[0]).toEqual(config.gains);
    expect(curves[1]).toEqual(config.gains);
    expect(headroom(bank(curves, 48000), 48000)).toBeCloseTo(7, 2);
    expect(effectiveCurves(config, true)).toEqual([
      Array(10).fill(0),
      Array(10).fill(0),
    ]);
  });
  it("migration is idempotent and rejects unsupported configuration versions", () => {
    for (const sample of normalization) {
      const config = validateSound(sample.input);
      expect(config.version).toBe(2);
      expect(Object.keys(config).sort()).toEqual(
        ["version", "enabled", "gains", "preamp", "presetId", "presets"].sort(),
      );
      expect(validateSound(config)).toEqual(config);
      expect(effectiveCurves(config)).toEqual([config.gains, config.gains]);
    }
    expect(() => validateSound({ ...defaultSound(), version: 3 })).toThrow();
  });
});
