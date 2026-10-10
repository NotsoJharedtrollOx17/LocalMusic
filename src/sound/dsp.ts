import { FREQUENCIES } from "./types";
export type Coefficients = [number, number, number, number, number];
export function coefficients(
  f: number,
  gain: number,
  rate: number,
): Coefficients {
  if (!gain || f >= rate / 2) return [1, 0, 0, 0, 0];
  const a = 10 ** (gain / 40),
    w = (2 * Math.PI * f) / rate,
    alpha = Math.sin(w) / (2 * 1.4),
    cos = Math.cos(w),
    a0 = 1 + alpha / a;
  return [
    (1 + alpha * a) / a0,
    (-2 * cos) / a0,
    (1 - alpha * a) / a0,
    (-2 * cos) / a0,
    (1 - alpha / a) / a0,
  ];
}
export function response(c: Coefficients, f: number, rate: number) {
  const w = (2 * Math.PI * f) / rate,
    [b0, b1, b2, a1, a2] = c;
  const nr = b0 + b1 * Math.cos(w) + b2 * Math.cos(2 * w),
    ni = -b1 * Math.sin(w) - b2 * Math.sin(2 * w);
  const dr = 1 + a1 * Math.cos(w) + a2 * Math.cos(2 * w),
    di = -a1 * Math.sin(w) - a2 * Math.sin(2 * w);
  return 10 * Math.log10((nr * nr + ni * ni) / (dr * dr + di * di));
}
export function bank(curves: number[][], rate: number) {
  return curves.map((curve) =>
    curve.map((g, i) => coefficients(FREQUENCIES[i], g, rate)),
  );
}
export function headroom(b: Coefficients[][], rate: number) {
  let peak = 0;
  for (let i = 0; i < 4096; i++) {
    const f = 20 * ((rate * 0.499) / 20) ** (i / 4095);
    for (const ear of b)
      peak = Math.max(
        peak,
        ear.reduce((v, c) => v + response(c, f, rate), 0),
      );
  }
  return peak > 0.0001 ? peak + 1 : 0;
}
export class FilterBank {
  private memory: number[][][];
  constructor(
    public coefficients: Coefficients[][],
    public gain: number,
  ) {
    this.memory = coefficients.map((ear) => ear.map(() => [0, 0]));
  }
  process(frame: number[]) {
    return frame.map((sample, ch) => {
      const index = Math.min(ch, 1),
        cs = this.coefficients[index];
      // Multichannel needs independent histories, even when the curve is shared.
      const memory =
        this.memory[ch] ?? (this.memory[ch] = cs.map(() => [0, 0]));
      let out = sample * this.gain;
      for (let i = 0; i < cs.length; i++) {
        const [b0, b1, b2, a1, a2] = cs[i],
          state = memory[i],
          y = b0 * out + state[0];
        state[0] = b1 * out - a1 * y + state[1];
        state[1] = b2 * out - a2 * y;
        out = y;
      }
      return out;
    });
  }
  reset() {
    this.memory = this.memory.map((ear) => ear.map(() => [0, 0]));
  }
}
export class SoundProcessor {
  private current: FilterBank;
  private previous?: FilterBank;
  private remaining = 0;
  private limiter = 1;
  private bypass = true;
  constructor(private rate: number) {
    this.current = new FilterBank(
      bank([Array(10).fill(0), Array(10).fill(0)], rate),
      1,
    );
  }
  configure(cs: Coefficients[][], gain: number, bypass: boolean) {
    this.previous = this.current;
    this.current = new FilterBank(cs, gain);
    this.remaining = Math.max(1, Math.round(this.rate * 0.02));
    this.bypass = bypass;
  }
  process(frame: number[]) {
    let output = this.bypass ? [...frame] : this.current.process(frame);
    if (this.previous && this.remaining > 0) {
      const old = this.previous.process(frame),
        blend = 1 - this.remaining / (this.rate * 0.02);
      output = output.map((x, i) => old[i] * (1 - blend) + x * blend);
      if (--this.remaining === 0) this.previous = undefined;
    }
    if (this.bypass && !this.previous) return output;
    const peak = Math.max(...output.map(Math.abs)),
      target = Math.min(1, 10 ** (-1 / 20) / Math.max(peak, 1e-12));
    this.limiter = Math.min(
      target,
      1 - (1 - this.limiter) * Math.exp(-1 / (this.rate * 0.05)),
    );
    return output.map((x) => x * this.limiter);
  }
  reset() {
    this.current.reset();
    this.previous = undefined;
    this.remaining = 0;
    this.limiter = 1;
  }
}
