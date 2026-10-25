import processorUrl from "./processor.worklet.ts?worker&url";
import { bank } from "./dsp";
import { defaultSound, effectiveCurves, validateSound } from "./model";
import type { SoundConfig, SoundState, SoundAction } from "./types";

/** Separate preview engine; library audio remains the browser journal authority. */
export class BrowserSound {
  private config = defaultSound();
  private ready: Promise<void>;
  private context?: AudioContext;
  private source?: MediaElementAudioSourceNode;
  private worklet?: AudioWorkletNode;
  private initializing?: Promise<void>;
  private failure = "";
  private bypass = false;
  private attenuation = 0;
  private channels = 2;
  private configurationReady = false;
  constructor(
    private audio: HTMLAudioElement,
    private read: () => Promise<unknown>,
    private write: (config: SoundConfig) => Promise<void>,
  ) {
    this.ready = this.restore().catch((error) => {
      this.failure = String(error);
    });
  }
  private async restore() {
    const stored = await this.read();
    const next = stored ? validateSound(stored) : defaultSound();
    this.config = next;
    await this.write(next);
    this.configurationReady = true;
    this.failure = "";
  }
  private supported() {
    return (
      typeof AudioContext !== "undefined" &&
      typeof AudioWorkletNode !== "undefined" &&
      window.isSecureContext
    );
  }
  async state(): Promise<SoundState> {
    await this.ready;
    const rate = this.context?.sampleRate ?? 48000;
    const status = this.failure
      ? "failed"
      : this.context?.state === "suspended"
        ? "activation"
        : this.worklet && !this.audio.paused
          ? "active"
          : "ready";
    return {
      supported: this.supported(),

      config: structuredClone(this.config),
      status,
      reason: this.failure || undefined,
      sampleRate: rate,
      channels: this.channels,
      attenuation: this.attenuation,
      bypass: this.bypass,
      inactiveBands: [31, 63, 125, 250, 500, 1000, 2000, 4000, 8000, 16000]
        .map((f, i) => (f >= rate / 2 ? i : -1))
        .filter((i) => i >= 0),
      routeMonitoring: false,
    };
  }
  async activate() {
    await this.ready;
    if (!this.configurationReady || !this.supported()) return;
    if (!this.initializing) this.initializing = this.initialize();
    await this.initializing;
    if (this.context?.state === "suspended") {
      try {
        await this.context.resume();
      } catch (e) {
        this.failure = String(e);
      }
    }
  }
  /** Stream changes may rebuild the processor; live controls keep its graph. */
  format(channels: number) {
    const next = Math.max(2, Math.min(32, Math.trunc(channels) || 2));
    if (next === this.channels) return;
    this.channels = next;
    this.worklet?.disconnect();
    this.worklet = undefined;
    this.initializing = undefined;
  }
  private async initialize() {
    try {
      this.context ??= new AudioContext();
      this.source ??= this.context.createMediaElementSource(this.audio);
      await this.context.audioWorklet.addModule(processorUrl);
      this.worklet = new AudioWorkletNode(this.context, "music-sound", {
        outputChannelCount: [this.channels],
      });
      const processor = this.worklet;
      processor.addEventListener("processorerror", () => {
        if (this.worklet !== processor) return;
        this.failure =
          "Audio processor stopped. Ordinary playback remains available.";
        processor.disconnect();
        this.source?.disconnect();
        if (this.context && this.source)
          this.source.connect(this.context.destination);
        this.worklet = undefined;
      });
      this.source.disconnect();
      this.source.connect(this.worklet).connect(this.context.destination);
      this.failure = "";
      this.apply();
    } catch (e) {
      this.failure = e instanceof Error ? e.message : String(e);
      if (this.context && this.source) {
        this.source.disconnect();
        this.source.connect(this.context.destination);
      }
    }
  }
  private apply() {
    if (!this.worklet || !this.context) return;
    const cs = bank(
      effectiveCurves(this.config, this.bypass),
      this.context.sampleRate,
    );
    this.attenuation = 0;
    this.worklet.port.postMessage({
      bank: cs,
      gain: 1,
      bypass: this.bypass || !this.config.enabled,
    });
  }
  async configure(config: SoundConfig) {
    await this.ready;
    const next = validateSound(config);
    await this.write(next);
    const wasReady = this.configurationReady;
    this.configurationReady = true;
    if (!wasReady) this.failure = "";
    this.config = next;
    if (!wasReady && !this.audio.paused) await this.activate();
    this.apply();
    return this.state();
  }
  async action(action: SoundAction) {
    if (action.op === "retry") {
      if (!this.configurationReady) {
        try {
          await this.restore();
        } catch (error) {
          this.failure = String(error);
          throw error;
        }
      }
      this.initializing = undefined;
      this.worklet?.disconnect();
      this.worklet = undefined;
      await this.activate();
    } else if (action.op === "bypass") {
      this.bypass = action.value;
      this.apply();
    } else {
      throw new Error("Unknown sound action");
    }
    return this.state();
  }
  reset() {
    this.worklet?.port.postMessage({ reset: true });
  }
}
