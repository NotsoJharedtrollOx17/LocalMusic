import { excerptRanges } from "./acoustic";
import type { AcousticFeature } from "./types";
export type AnalysisTrack = {
  id: string;
  sourceUri: string;
  durationMs: number;
  file: Blob;
  audioChannels?: number;
};
const ANALYSIS_RATE = 48000;
export const browserFingerprint = (t: AnalysisTrack) =>
  JSON.stringify([
    1,
    t.sourceUri,
    t.durationMs,
    t.file.size,
    (t.file as File).lastModified ?? 0,
  ]);
export class BrowserAnalysis {
  private epoch = 0;
  private lease = 0;
  private worker?: Worker;
  private rejectWorker?: () => void;
  busy = false;
  failed = new Map<string, number>();
  constructor(private playing: () => boolean) {}
  activity(active: boolean) {
    if (active) this.lease = performance.now() + 4000;
    else {
      this.lease = 0;
      this.epoch++;
      this.worker?.terminate();
      this.rejectWorker?.();
    }
  }
  private allowed(epoch: number) {
    return (
      epoch === this.epoch &&
      this.lease > performance.now() &&
      !document.hidden &&
      !this.playing()
    );
  }
  async analyze(
    t: AnalysisTrack,
    save: (f: AcousticFeature, current: () => boolean) => Promise<void>,
  ) {
    const epoch = this.epoch,
      fingerprint = browserFingerprint(t);
    if (
      this.busy ||
      !this.allowed(epoch) ||
      (this.failed.get(fingerprint) ?? 0) > Date.now()
    )
      return;
    this.busy = true;
    const deadline = performance.now() + 30000;
    const current = () => this.allowed(epoch) && performance.now() < deadline;
    const expiry = window.setInterval(() => {
      if (!current()) {
        this.worker?.terminate();
        this.rejectWorker?.();
      }
    }, 100);
    try {
      const channels = t.audioChannels;
      if (
        t.file.size <= 0 ||
        t.file.size > 16 * 1024 * 1024 ||
        !channels ||
        channels > 8 ||
        !t.durationMs ||
        (t.durationMs / 1000) * channels * ANALYSIS_RATE * 4 > 64 * 1024 * 1024
      )
        throw new Error("Metadata-only source");
      const context = new OfflineAudioContext(1, 1, ANALYSIS_RATE);
      const encoded = await t.file.arrayBuffer();
      if (!current()) return;
      const decoded = await context.decodeAudioData(encoded);
      if (!current()) return;
      if (
        decoded.numberOfChannels > 8 ||
        decoded.length * decoded.numberOfChannels * 4 > 64 * 1024 * 1024
      )
        throw new Error("Metadata-only source");
      const clips = excerptRanges(decoded.duration).map(([a, b]) =>
        Array.from({ length: decoded.numberOfChannels }, (_, c) =>
          decoded
            .getChannelData(c)
            .slice(
              Math.floor(a * decoded.sampleRate),
              Math.floor(b * decoded.sampleRate),
            ),
        ),
      );
      const feature = await new Promise<AcousticFeature | null>(
        (resolve, reject) => {
          const worker = (this.worker = new Worker(
            new URL("./acoustic.worker.ts", import.meta.url),
            { type: "module" },
          ));
          this.rejectWorker = () => reject(new Error("Canceled"));
          worker.onmessage = (e) =>
            e.data.error
              ? reject(new Error(e.data.error))
              : resolve(e.data.feature);
          worker.onerror = () => reject(new Error("Audio analysis failed"));
          worker.postMessage(
            { channels: clips, rate: decoded.sampleRate, fingerprint },
            clips.flat().map((c) => c.buffer),
          );
        },
      );
      if (current() && feature) await save(feature, current);
      else if (this.allowed(epoch))
        this.failed.set(fingerprint, Date.now() + 300000);
    } catch {
      if (this.allowed(epoch))
        this.failed.set(fingerprint, Date.now() + 300000);
    } finally {
      clearInterval(expiry);
      this.worker?.terminate();
      this.worker = undefined;
      this.rejectWorker = undefined;
      this.busy = false;
    }
  }
}
