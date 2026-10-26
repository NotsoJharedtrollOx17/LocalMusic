import { VisualizerAnalysis } from "./analysis";
import { FFT_SIZE } from "./types";
const analyze = new VisualizerAnalysis(),
  left = new Float32Array(FFT_SIZE),
  right = new Float32Array(FFT_SIZE),
  orderedL = new Float32Array(FFT_SIZE),
  orderedR = new Float32Array(FFT_SIZE);
let port: MessagePort | undefined,
  cursor = 0,
  count = 0,
  sequence = 0,
  last = -Infinity;
self.onmessage = ({
  data,
}: MessageEvent<{ port: MessagePort; generation: number }>) => {
  port?.close();
  port = data.port;
  const generation = data.generation;
  cursor = count = sequence = 0;
  last = -Infinity;
  analyze.reset();
  port.onmessage = ({
    data: block,
  }: MessageEvent<{
    buffer: ArrayBuffer;
    frames: number;
    positionMs: number;
    rate: number;
  }>) => {
    const samples = new Float32Array(block.buffer);
    for (let i = 0; i < block.frames; i++) {
      left[cursor] = samples[i * 2];
      right[cursor] = samples[i * 2 + 1];
      cursor = (cursor + 1) % FFT_SIZE;
      count++;
    }
    port?.postMessage(block.buffer, [block.buffer]);
    const now = performance.now();
    if (count < FFT_SIZE || now - last < 1000 / 30) return;
    last = now;
    for (let i = 0; i < FFT_SIZE; i++) {
      const j = (cursor + i) % FFT_SIZE;
      orderedL[i] = left[j];
      orderedR[i] = right[j];
    }
    const frame = analyze.analyze(orderedL, orderedR, block.rate);
    frame.generation = generation;
    frame.sequence = ++sequence;
    frame.positionMs = Math.max(
      0,
      block.positionMs - (FFT_SIZE / block.rate) * 500,
    );
    self.postMessage(frame);
  };
  port.start();
};
