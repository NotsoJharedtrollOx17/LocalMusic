import { it, expect, vi, afterEach } from "vitest";
afterEach(() => vi.unstubAllGlobals());
it("a failed visual PCM transport cannot interrupt or alter the audio output", async () => {
  let Constructor: any;
  vi.stubGlobal("sampleRate", 48000);
  vi.stubGlobal("currentTime", 0);
  vi.stubGlobal(
    "AudioWorkletProcessor",
    class {
      port = { onmessage: undefined as any };
    },
  );
  vi.stubGlobal("registerProcessor", (_name: string, processor: unknown) => {
    Constructor = processor;
  });
  await import("../sound/processor.worklet");
  const processor = new Constructor();
  const port = {
    close() {},
    start() {},
    postMessage() {
      throw new Error("Visual channel failed");
    },
    onmessage: null,
  };
  processor.port.onmessage({
    data: { visualizerPort: port, visualizerUntil: 3 },
  });
  const input = Float32Array.from(
      { length: 4096 },
      (_, i) => Math.sin(i * 0.1) * 0.1,
    ),
    left = new Float32Array(input.length),
    right = new Float32Array(input.length);
  expect(processor.process([[input]], [[left, right]])).toBe(true);
  expect(left).toEqual(input);
  expect(right).toEqual(input);
  expect(processor.process([[input]], [[left, right]])).toBe(true);
  expect(left).toEqual(input);
});
