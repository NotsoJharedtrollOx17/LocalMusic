import { describe, it, expect, vi, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { coefficients, response, bank, headroom, SoundProcessor } from "./dsp";
import { defaultSound, validateSound, effectiveCurves } from "./model";
import { PersonalProtocol, tone, deriveCurve } from "./personal";
import { renderComparison } from "./comparison";
afterEach(() => vi.restoreAllMocks());
describe("shared sound processing", () => {
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
    expect(validateSound(defaultSound()).enabled).toBe(false);
    expect(validateSound({ ...defaultSound(), preamp: 12 }).preamp).toBe(12);
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
    expect(effectiveCurves(c)[0][5]).toBe(3);
    expect(effectiveCurves(c, false, 6)[0][5]).toBe(0);
  });
});
describe("personal listening protocol", () => {
  it("limits amplitude, fades pulses and isolates the selected ear", () => {
    const samples = tone(1000, -36, 1);
    expect(samples.length).toBe(76800);
    expect(samples[0]).toBe(0);
    for (let i = 0; i < samples.length; i += 2) {
      expect(samples[i]).toBe(0);
      expect(Math.abs(samples[i + 1])).toBeLessThanOrEqual(
        10 ** (-36 / 20) + 1e-9,
      );
    }
    expect(() => tone(1000, -12, 0)).toThrow();
  });
  it("enforces replay spacing, reference retry, lease and raw-data discard", () => {
    let time = 0;
    vi.spyOn(performance, "now").mockImplementation(() => time);
    const p = new PersonalProtocol();
    expect(() => p.respond(true)).toThrow();
    p.pulse();
    expect(() => p.pulse()).toThrow();
    expect(() => p.respond(true)).toThrow();
    for (let i = 0; i < 4; i++) {
      if (i) {
        time += 500;
        p.pulse();
      }
      time += 800;
      p.respond(false);
    }
    expect(p.state.phase).toBe("retry");
    p.retry();
    expect(p.state.level).toBe(-54);
    time += 2100;
    expect(() => p.heartbeat()).toThrow();
    expect(p.state.phase).toBe("cancelled");
  });
  it("completes both ears without enabling effects and matches preview loudness", () => {
    let time = 0;
    vi.spyOn(performance, "now").mockImplementation(() => time);
    const p = new PersonalProtocol();
    for (let i = 0; i < 14; i++) {
      p.pulse();
      time += 800;
      p.respond(true);
      time += 500;
    }
    expect(p.state.phase).toBe("compare");
    const profile = p.profile("Headphones");
    expect(profile.left).toEqual(Array(10).fill(0));
    expect(profile.complete.every(Boolean)).toBe(true);
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
