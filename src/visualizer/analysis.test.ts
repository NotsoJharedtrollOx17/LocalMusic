import { describe, it, expect } from "vitest";
import fixtures from "../../tests/fixtures/visualizer-analysis.json";
import { VisualizerAnalysis } from "./analysis";
import { FFT_SIZE as N } from "./types";
import { VisualizerCapture } from "./capture.worklet";
import { SoundProcessor, bank } from "../sound/dsp";
describe("shared FFT fixtures (independent NumPy reference)", () => {
  for (const f of fixtures)
    it(f.name, () => {
      const left = new Float64Array(N),
        right = new Float64Array(N);
      let seed = 17;
      for (let i = 0; i < N; i++) {
        if (f.signal === "tone")
          left[i] =
            Math.sin((i * 2 * Math.PI * f.frequency!) / f.rate) * f.amplitude!;
        else if (f.signal === "impulse") left[i] = i === N / 2 ? 1 : 0;
        else if (f.signal === "noise") {
          seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
          left[i] = (seed / 4294967296 - 0.5) * 0.5;
        }
        right[i] = left[i] * (f.signal === "impulse" ? -1 : (f.right ?? 1));
      }
      const analyzer = new VisualizerAnalysis(),
        result = analyzer.analyze(left, right, f.rate);
      expect(result.rms).toBeCloseTo(f.expected.rms, 9);
      for (let i = 0; i < 64; i++)
        expect(result.spectrum[i]).toBeCloseTo(f.expected.spectrum[i], 7);
      for (let i = 0; i < 256; i++)
        expect(result.waveform[i]).toBeCloseTo(f.expected.waveform[i], 9);
      expect(result.onset).toBeCloseTo(Math.min(1, f.expected.rms * 8), 8);
      expect(analyzer.analyze(left, right, f.rate).onset).toBe(0);
    });
});
it("analysis measures the actual EQ result with no changes to processing", () => {
  const dsp = new SoundProcessor(48000);
  const curve = Array(10).fill(0);
  curve[5] = 6;
  dsp.configure(bank([curve, curve], 48000), 1, false);
  const left = new Float64Array(N),
    right = new Float64Array(N);
  for (let i = 0; i < N * 4; i++) {
    const sample = Math.sin((i * 2 * Math.PI * 1000) / 48000) * 0.05;
    const out = dsp.process([sample, -sample]);
    if (i >= N * 3) {
      left[i - N * 3] = out[0];
      right[i - N * 3] = out[1];
    }
  }
  const before = left.slice(),
    result = new VisualizerAnalysis().analyze(left, right, 48000);
  expect(20 * Math.log10(result.rms / (0.05 / Math.sqrt(2)))).toBeCloseTo(6, 1);
  expect(left).toEqual(before);
});
it("post-DSP capture never changes multichannel output and drops data when busy", () => {
  const capture = new VisualizerCapture();
  const blocks: unknown[] = [];
  const port = {
    close() {},
    start() {},
    onmessage: null,
    postMessage: (data: unknown) => blocks.push(data),
  } as unknown as MessagePort;
  capture.configure({ visualizerPort: port, visualizerUntil: 3 }, 48000);
  const output = Array.from({ length: 6 }, (_, ch) =>
    Float32Array.from(
      { length: 128 },
      (_, i) => Math.sin(i / 10) * (ch === 4 ? 0.5 : 0),
    ),
  );
  const before = output.map((ch) => ch.slice());
  for (let i = 0; i < 100; i++)
    capture.capture(output, (i * 128) / 48000, 48000);
  expect(blocks).toHaveLength(3);
  expect(output).toEqual(before);
  const block = blocks[0] as { buffer: ArrayBuffer };
  const samples = new Float32Array(block.buffer);
  expect(Math.max(...samples)).toBeGreaterThan(0.49);
  capture.configure({ visualizerStop: true }, 48000);
  capture.capture(output, 0, 48000);
  expect(blocks).toHaveLength(3);
});
