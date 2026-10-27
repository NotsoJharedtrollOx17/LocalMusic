import { AcousticAnalysis } from "./acoustic";
self.onmessage = (
  event: MessageEvent<{
    channels: Float32Array[][];
    rate: number;
    fingerprint: string;
  }>,
) => {
  try {
    const a = new AcousticAnalysis();
    for (const excerpt of event.data.channels) a.add(excerpt, event.data.rate);
    self.postMessage({ feature: a.finish(event.data.fingerprint) });
  } catch {
    self.postMessage({ error: "Audio analysis failed" });
  }
};
