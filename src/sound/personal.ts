import { FREQUENCIES } from "./types";
import { CALIBRATION_LEVELS } from "./calibration";
export const TEST_FREQUENCIES = [1000, 250, 500, 2000, 4000, 8000];
const LEVELS = CALIBRATION_LEVELS;
export function deriveCurve(values: (number | null)[]) {
  const fs = [250, 500, 1000, 2000, 4000, 8000],
    indexes = [1, 2, 0, 3, 4, 5],
    ref = values[0];
  return FREQUENCIES.map((f) => {
    if (ref === null || f < 250 || f > 8000) return 0;
    const i = fs.findIndex((v) => v >= f),
      j = Math.max(0, i - 1),
      a = values[indexes[j]],
      b = values[indexes[i]];
    if (f === fs[i]) return b == null ? 0 : Math.max(0, Math.min(6, b - ref));
    if (a === null || b === null) return 0;
    const t = i === j ? 0 : Math.log(f / fs[j]) / Math.log(fs[i] / fs[j]);
    return Math.max(0, Math.min(6, a + (b - a) * t - ref));
  });
}
export function tone(
  frequency: number,
  level: number,
  ear: number,
  rate = 48000,
): Float32Array {
  if (
    !TEST_FREQUENCIES.includes(frequency) ||
    !LEVELS.includes(level) ||
    ![0, 1].includes(ear) ||
    rate <= frequency * 2
  )
    throw new Error("Invalid test tone");
  const frames = Math.round(rate * 3.4),
    out = new Float32Array(frames * 2),
    amplitude = 10 ** (level / 20);
  for (let i = 0; i < frames; i++) {
    const local = i % Math.round(rate * 1.3);
    if (local >= Math.round(rate * 0.8)) continue;
    const fade = Math.min(
      1,
      local / (rate * 0.1),
      (Math.round(rate * 0.8) - 1 - local) / (rate * 0.1),
    );
    out[i * 2 + ear] =
      Math.sin((2 * Math.PI * frequency * local) / rate) *
      amplitude *
      Math.max(0, fade);
  }
  return out;
}
export function comparisonSample(rate = 48000) {
  const frames = rate * 4,
    out = new Float32Array(frames * 2),
    notes = [220, 261.63, 329.63, 293.66];
  for (let i = 0; i < frames; i++) {
    const t = i / rate,
      local = t % 1,
      env = Math.min(1, local / 0.05, (1 - local) / 0.1),
      f = notes[Math.floor(t)];
    const sample =
      (Math.sin(2 * Math.PI * f * t) +
        0.3 * Math.sin(2 * Math.PI * f * 2 * t) +
        0.15 * Math.sin(2 * Math.PI * f * 4 * t)) *
      0.025 *
      env;
    out[i * 2] = out[i * 2 + 1] = sample;
  }
  return out;
}
