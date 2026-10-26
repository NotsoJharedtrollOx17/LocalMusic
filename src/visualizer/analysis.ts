import {
  FFT_SIZE as N,
  BANDS,
  WAVE_POINTS,
  emptyFrame,
  type VisualizerFrame,
} from "./types";

/** Original radix-two FFT. Workspaces and twiddles are reused outside the audio callback. */
export class VisualizerAnalysis {
  private real = new Float64Array(N);
  private imag = new Float64Array(N);
  private power = new Float64Array(N / 2 + 1);
  private window = Float64Array.from(
    { length: N },
    (_, i) =>
      0.42 -
      0.5 * Math.cos((2 * Math.PI * i) / (N - 1)) +
      0.08 * Math.cos((4 * Math.PI * i) / (N - 1)),
  );
  private cos = Float64Array.from({ length: N / 2 }, (_, i) =>
    Math.cos((2 * Math.PI * i) / N),
  );
  private sin = Float64Array.from(
    { length: N / 2 },
    (_, i) => -Math.sin((2 * Math.PI * i) / N),
  );
  private previousRms = 0;
  reset() {
    this.previousRms = 0;
  }
  analyze(
    left: ArrayLike<number>,
    right: ArrayLike<number>,
    rate: number,
  ): VisualizerFrame {
    this.power.fill(0);
    let lp = 0,
      rp = 0;
    for (let channel = 0; channel < 2; channel++) {
      const samples = channel ? right : left;
      for (let i = 0; i < N; i++) {
        const value = Number.isFinite(samples[i]) ? samples[i] : 0;
        if (channel) rp += value * value;
        else lp += value * value;
        this.real[i] = value * this.window[i];
        this.imag[i] = 0;
      }
      for (let i = 1, j = 0; i < N; i++) {
        let bit = N >> 1;
        for (; j & bit; bit >>= 1) j ^= bit;
        j ^= bit;
        if (i < j) {
          const x = this.real[i];
          this.real[i] = this.real[j];
          this.real[j] = x;
        }
      }
      for (let size = 2; size <= N; size *= 2) {
        const half = size / 2,
          step = N / size;
        for (let base = 0; base < N; base += size)
          for (let k = 0; k < half; k++) {
            const a = base + k,
              b = a + half,
              c = this.cos[k * step],
              s = this.sin[k * step];
            const re = c * this.real[b] - s * this.imag[b],
              im = s * this.real[b] + c * this.imag[b];
            this.real[b] = this.real[a] - re;
            this.imag[b] = this.imag[a] - im;
            this.real[a] += re;
            this.imag[a] += im;
          }
      }
      for (let i = 0; i <= N / 2; i++)
        this.power[i] += (this.real[i] ** 2 + this.imag[i] ** 2) / 2;
    }
    const result = emptyFrame(),
      upper = Math.max(41, Math.min(20000, rate / 2));
    result.sampleRate = rate;
    result.rms = Math.sqrt((lp + rp) / (2 * N));
    for (let b = 0; b < BANDS; b++) {
      const lo = Math.max(
        1,
        Math.floor((40 * (upper / 40) ** (b / BANDS) * N) / rate),
      );
      const hi = Math.min(
        N / 2,
        Math.max(
          lo,
          Math.ceil((40 * (upper / 40) ** ((b + 1) / BANDS) * N) / rate),
        ),
      );
      let peak = 0;
      for (let k = lo; k <= hi; k++) peak = Math.max(peak, this.power[k]);
      const db =
        20 * Math.log10(Math.max(1e-12, (2 * Math.sqrt(peak)) / (N * 0.42)));
      result.spectrum[b] = Math.max(0, Math.min(1, (db + 72) / 72));
    }
    const wave = rp > lp ? right : left;
    for (let i = 0; i < WAVE_POINTS / 2; i++) {
      let min = 1,
        max = -1;
      for (let j = i * 16; j < (i + 1) * 16; j++) {
        const x = Number.isFinite(wave[j]) ? wave[j] : 0;
        min = Math.min(min, x);
        max = Math.max(max, x);
      }
      result.waveform[i * 2] = Math.max(-1, min);
      result.waveform[i * 2 + 1] = Math.min(1, max);
    }
    result.bass = Math.max(...result.spectrum.slice(0, 20));
    result.mid = Math.max(...result.spectrum.slice(20, 42));
    result.treble = Math.max(...result.spectrum.slice(42));
    result.onset = Math.min(
      1,
      Math.max(0, (result.rms - this.previousRms) * 8),
    );
    this.previousRms = result.rms;
    return result;
  }
}
