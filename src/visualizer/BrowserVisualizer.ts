import type { BrowserSound } from "../sound/BrowserSound";
import type { VisualizerFrame, VisualizerSession } from "./types";
import { visualizerCapabilities } from "./types";

/** Owns transient analysis only; never asks the catalog/journal for a snapshot. */
export class BrowserVisualizer {
  private session?: VisualizerSession;
  private worker?: Worker;
  private node?: AudioWorkletNode;
  private frames: VisualizerFrame[] = [];
  private generation = 0;
  private failure = false;
  private renewed = 0;
  private capturing = false;
  private lease?: ReturnType<typeof setTimeout>;
  constructor(
    private audio: HTMLAudioElement,
    private sound: BrowserSound,
  ) {}
  private reset = () => {
    if (this.session)
      try {
        this.attach();
      } catch {
        this.failure = true;
      }
  };
  start(): VisualizerSession {
    if (this.session) this.stop(this.session.id);
    this.session = {
      id: crypto.randomUUID(),
      capabilities: visualizerCapabilities,
    };
    try {
      this.worker = new Worker(
        new URL("./analysis.worker.ts", import.meta.url),
        { type: "module" },
      );
      this.worker.onerror = () => {
        this.failure = true;
      };
      this.worker.onmessage = ({ data }: MessageEvent<VisualizerFrame>) => {
        if (data.generation !== this.generation) return;
        this.frames.push(data);
        if (this.frames.length > 90) this.frames.shift();
      };
      for (const name of ["seeking", "loadedmetadata", "ratechange"])
        this.audio.addEventListener(name, this.reset);
      this.failure = false;
      this.attach();
      this.renew();
      return this.session;
    } catch (error) {
      this.stop(this.session.id);
      throw error;
    }
  }
  private attach() {
    const output = this.sound.visualizerOutput();
    if (!output) throw new Error("Audio analysis unavailable");
    this.node?.port.postMessage({ visualizerStop: true });
    this.node = output.node;
    this.capturing = true;
    this.frames = [];
    this.generation++;
    const channel = new MessageChannel();
    this.worker!.postMessage(
      { port: channel.port1, generation: this.generation },
      [channel.port1],
    );
    output.node.port.postMessage(
      {
        visualizerPort: channel.port2,
        visualizerUntil: output.context.currentTime + 3,
        visualizerOffset:
          this.audio.currentTime * 1000 - output.context.currentTime * 1000,
      },
      [channel.port2],
    );
    this.renewed = performance.now();
  }
  private renew() {
    clearTimeout(this.lease);
    const id = this.session!.id;
    this.lease = setTimeout(() => this.stop(id), 3000);
    const output = this.sound.visualizerOutput();
    if (output && performance.now() - this.renewed > 900) {
      output.node.port.postMessage({
        visualizerUntil: output.context.currentTime + 3,
      });
      this.renewed = performance.now();
    }
  }
  read(id: string): VisualizerFrame | null {
    if (this.session?.id !== id) throw new Error("Expired visualizer");
    if (this.failure) throw new Error("Audio analysis unavailable");
    this.renew();
    if (this.audio.paused || this.audio.readyState < 3) {
      if (this.capturing) {
        this.node?.port.postMessage({ visualizerStop: true });
        this.capturing = false;
        this.frames = [];
      }
      return null;
    }
    if (!this.capturing || this.node !== this.sound.visualizerOutput()?.node)
      this.attach();
    const position = this.audio.currentTime * 1000;
    // Analysis windows are centered on their actual PCM time, never decoder arrival time.
    for (let i = this.frames.length - 1; i >= 0; i--) {
      const f = this.frames[i];
      if (f.positionMs <= position + 20 && position - f.positionMs < 160)
        return f;
    }
    return null;
  }
  stop(id: string) {
    if (this.session?.id !== id) return;
    clearTimeout(this.lease);
    this.worker?.terminate();
    this.worker = undefined;
    this.node?.port.postMessage({ visualizerStop: true });
    this.node = undefined;
    for (const name of ["seeking", "loadedmetadata", "ratechange"])
      this.audio.removeEventListener(name, this.reset);
    this.frames = [];
    this.session = undefined;
  }
}
