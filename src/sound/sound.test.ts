import { describe, it, expect, vi, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { coefficients, response, bank, headroom, SoundProcessor } from "./dsp";
import { defaultSound, validateSound, effectiveCurves } from "./model";
import { tone, deriveCurve } from "./personal";
import { PersonalProtocol } from "./PersonalProtocol";
import { renderComparison } from "./comparison";
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
  it("upgrades legacy profile strength and removes hidden manual preamp", () => {
    const saved = validateSound({ ...defaultSound(), strength: 50, preamp: 3 });
    expect(saved.strength).toBe(100);
    expect(saved.preamp).toBe(0);
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
      validateSound({ ...defaultSound(), personalEnabled: true }),
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
  it("adds headroom for a boosted curve and removes personal processing from multichannel", () => {
    const curves = [Array(10).fill(0), Array(10).fill(0)];
    curves[0][5] = 6;
    expect(headroom(bank(curves, 48000), 48000)).toBeCloseTo(7, 2);
    const c = {
      ...defaultSound(),
      profiles: [
        {
          id: "p",
          name: "P",
          left: Array(10).fill(6),
          right: Array(10).fill(0),
          complete: Array(12).fill(true),
        },
      ],
      profileId: "p",
      personalEnabled: true,
      strength: 50,
    };
    c.enabled = true;
    c.gains = Array(10).fill(12);
    expect(effectiveCurves(c)[0][5]).toBe(3);
    expect(effectiveCurves(c, false, 6)[0][5]).toBe(12);
  });
});
describe("personal listening protocol", () => {
  it("limits amplitude, fades pulses and isolates the selected ear", () => {
    const samples = tone(1000, -36, 1);
    expect(samples.length).toBe(326400);
    expect(samples[0]).toBe(0);
    let leftPeak = 0,
      rightPeak = 0;
    for (let i = 0; i < samples.length; i += 2) {
      leftPeak = Math.max(leftPeak, Math.abs(samples[i]));
      rightPeak = Math.max(rightPeak, Math.abs(samples[i + 1]));
    }
    expect(leftPeak).toBe(0);
    expect(rightPeak).toBeLessThanOrEqual(10 ** (-36 / 20) + 1e-9);
    expect(samples.slice(76800, 124800).every((x) => x === 0)).toBe(true);
    expect(() => tone(1000, -12, 0)).toThrow();
  });
  it("completes both ears without enabling effects and matches preview loudness", () => {
    let time = 0;
    vi.spyOn(performance, "now").mockImplementation(() => time);
    const p = new PersonalProtocol();
    for (let i = 0; i < 36; i++) {
      p.pulse(p.state.trialId);
      for (let j = 0; j < 3; j++) {
        time += 1000;
        p.heartbeat();
      }
      time += 400;
      p.respond(true, p.state.trialId);
      time += 500;
    }
    expect(p.state.phase).toBe("compare");
    const profile = p.profile("Headphones");
    expect(profile.left).toEqual(Array(10).fill(0));
    expect(profile.complete.every((x) => !x)).toBe(true);
    expect(
      profile.calibration?.coverage.every((x) => x === "below-floor"),
    ).toBe(true);
    const original = renderComparison(profile, 50, "original"),
      personal = renderComparison(profile, 50, "personal");
    expect(original.length).toBe(personal.length);
    const energy = (a: Float32Array) => a.reduce((v, x) => v + x * x, 0);
    expect(energy(original)).toBeCloseTo(energy(personal), 5);
    p.state.phase = "saved";
    p.discard();
    expect(() => p.profile("Again")).toThrow();
    p.cancel();
  });
  it("unknown regions receive zero and relative suggestions are bounded", () => {
    const c = deriveCurve([-48, -42, -48, -42, -36, null]);
    expect(c[3]).toBe(6);
    expect(c[5]).toBe(0);
    expect(c[8]).toBe(0);
    expect(c[9]).toBe(0);
    expect(c.every((x) => x >= 0 && x <= 6)).toBe(true);
  });
});
