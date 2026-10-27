import type { AcousticFeature } from "./types";
export const FFT_SIZE = 2048;
/** Fixed 40 Hz–20 kHz log bands, Hann windows, sum of channel powers. */
export class AcousticAnalysis {
  private real = new Float64Array(FFT_SIZE);
  private imag = new Float64Array(FFT_SIZE);
  private bands = new Float64Array(32);
  private samples = 0;
  private cosine = Float64Array.from({ length: FFT_SIZE / 2 }, (_, i) =>
    Math.cos((2 * Math.PI * i) / FFT_SIZE),
  );
  private sine = Float64Array.from(
    { length: FFT_SIZE / 2 },
    (_, i) => -Math.sin((2 * Math.PI * i) / FFT_SIZE),
  );
  private window = Float64Array.from(
    { length: FFT_SIZE },
    (_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (FFT_SIZE - 1)),
  );
  add(channels: Float32Array[], rate: number) {
    if (rate < 8000 || rate > 192000 || !channels.length || channels.length > 8)
      return;
    const n = FFT_SIZE;
    for (let offset = 0; offset + n <= channels[0].length; offset += n) {
      for (const channel of channels) {
        for (let i = 0; i < n; i++) {
          const x = channel[offset + i];
          this.real[i] = (Number.isFinite(x) ? x : 0) * this.window[i];
          this.imag[i] = 0;
        }
        for (let i = 1, j = 0; i < n; i++) {
          let bit = n >> 1;
          for (; j & bit; bit >>= 1) j ^= bit;
          j ^= bit;
          if (i < j) {
            const x = this.real[i];
            this.real[i] = this.real[j];
            this.real[j] = x;
          }
        }
        for (let size = 2; size <= n; size *= 2)
          for (let base = 0; base < n; base += size)
            for (let k = 0; k < size / 2; k++) {
              const a = base + k,
                b = a + size / 2,
                c = this.cosine[(k * n) / size],
                s = this.sine[(k * n) / size],
                re = c * this.real[b] - s * this.imag[b],
                im = s * this.real[b] + c * this.imag[b];
              this.real[b] = this.real[a] - re;
              this.imag[b] = this.imag[a] - im;
              this.real[a] += re;
              this.imag[a] += im;
            }
        for (let k = 1; k <= n / 2; k++) {
          const hz = (k * rate) / n;
          if (hz < 40 || hz >= 20000) continue;
          const b = Math.min(
            31,
            Math.floor((Math.log(hz / 40) / Math.log(500)) * 32),
          );
          this.bands[b] +=
            (this.real[k] ** 2 + this.imag[k] ** 2) / (n * n * channels.length);
        }
      }
      this.samples += n / rate;
    }
  }
  finish(fingerprint: string): AcousticFeature | null {
    const total = this.bands.reduce((a, b) => a + b, 0);
    if (this.samples < 0.1 || total / this.samples < 1e-10) return null;
    return {
      version: 1,
      fingerprint,
      bands: Array.from(this.bands, (x) => x / total),
      seconds: this.samples,
    };
  }
}
export function excerptRanges(duration: number): [number, number][] {
  if (!Number.isFinite(duration) || duration <= 0) return [];
  if (duration <= 24) return [[0, duration]];
  const out: [number, number][] = [];
  for (const ratio of [0.15, 0.5, 0.85]) {
    const start = Math.min(
      duration - 8,
      Math.max(out.at(-1)?.[1] ?? 0, duration * ratio - 4),
    );
    if (!out.length || start >= out.at(-1)![1]) out.push([start, start + 8]);
  }
  return out;
}
