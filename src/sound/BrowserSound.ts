import processorUrl from "./processor.worklet.ts?worker&url";
import { bank, headroom } from "./dsp";
import { defaultSound, effectiveCurves, validateSound } from "./model";
import { PersonalProtocol } from "./personal";
import { renderComparison } from "./comparison";
import type {
  SoundConfig,
  SoundState,
  SoundAction,
  PersonalAction,
  PersonalSession,
} from "./types";

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
  private routeGeneration = 0;
  private channels = 2;
  private session?: PersonalProtocol;
  private sample?: AudioBufferSourceNode;
  constructor(
    private audio: HTMLAudioElement,
    read: () => Promise<SoundConfig | undefined>,
    private write: (config: SoundConfig) => Promise<void>,
    private pause: () => Promise<void>,
  ) {
    this.ready = read().then((c) => {
      if (c) this.config = validateSound(c);
    });
    const interrupt = () => {
      this.routeGeneration++;
      this.stop();
      this.session?.cancel();
      if (this.config.personalEnabled) {
        this.config = { ...this.config, personalEnabled: false };
        this.apply();
        void this.write(this.config);
      }
    };
    window.addEventListener("blur", () => {
      this.stop();
      this.session?.cancel();
    });
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        this.stop();
        this.session?.cancel();
      }
    });
    navigator.mediaDevices?.addEventListener("devicechange", interrupt);
    window.setInterval(() => {
      if (this.session && !this.session.alive()) this.stop();
    }, 100);
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
      systemPanel: false,
      config: structuredClone(this.config),
      status,
      reason: this.failure || undefined,
      sampleRate: rate,
      channels: this.channels,
      attenuation: this.attenuation,
      bypass: this.bypass,
      inactiveBands: [31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000]
        .map((f, i) => (f >= rate / 2 ? i : -1))
        .filter((i) => i >= 0),
      personalAvailable: this.channels <= 2,
      routeMonitoring: false,
      routeGeneration: this.routeGeneration,
    };
  }
  async activate() {
    await this.ready;
    if (!this.supported()) return;
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
        this.stop();
        this.session?.cancel();
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
      effectiveCurves(this.config, this.bypass, this.channels),
      this.context.sampleRate,
    );
    this.attenuation = headroom(cs, this.context.sampleRate);
    this.worklet.port.postMessage({
      bank: cs,
      gain:
        10 **
        (((!this.bypass &&
        (this.config.enabled ||
          (this.config.personalEnabled && this.channels <= 2))
          ? this.config.preamp
          : 0) -
          this.attenuation) /
          20),
      bypass:
        this.bypass ||
        (!this.config.enabled &&
          (!this.config.personalEnabled || this.channels > 2)),
    });
  }
  async configure(config: SoundConfig, authorizePersonal = false) {
    await this.ready;
    const next = validateSound(config);
    if (
      next.personalEnabled &&
      !this.config.personalEnabled &&
      !authorizePersonal
    )
      throw new Error("Confirm headphones with Use profile first");
    await this.write(next);
    this.config = next;
    this.apply();
    return this.state();
  }
  async action(action: SoundAction) {
    if (action.op === "profile-use") {
      if (this.channels > 2)
        throw new Error("Personal sound requires mono or stereo audio");
      if (action.routeGeneration !== this.routeGeneration)
        throw new Error("Output changed. Confirm headphones again.");
      return this.configure(
        { ...this.config, profileId: action.id, personalEnabled: true },
        true,
      );
    }
    if (action.op === "retry") {
      this.initializing = undefined;
      this.worklet?.disconnect();
      this.worklet = undefined;
      await this.activate();
    } else {
      this.bypass = action.value;
      this.apply();
    }
    return this.state();
  }
  reset() {
    this.worklet?.port.postMessage({ reset: true });
  }
  private stop() {
    try {
      this.sample?.stop();
    } catch {}
    this.sample?.disconnect();
    this.sample = undefined;
  }
  private play(samples: Float32Array) {
    if (!this.context || this.context.state !== "running")
      throw new Error("Activate audio before starting sound setup");
    this.stop();
    const buffer = this.context.createBuffer(2, samples.length / 2, 48000);
    for (let ch = 0; ch < 2; ch++) {
      const channel = buffer.getChannelData(ch);
      for (let i = 0; i < channel.length; i++) channel[i] = samples[i * 2 + ch];
    }
    this.sample = this.context.createBufferSource();
    this.sample.buffer = buffer;
    this.sample.connect(this.context.destination);
    this.sample.start();
  }
  async personal(action: PersonalAction): Promise<PersonalSession> {
    await this.ready;
    if (action.op === "start") {
      if (this.channels > 2)
        throw new Error("Personal sound requires mono or stereo audio");
      await this.pause();
      this.stop();
      this.session?.cancel();
      await this.activate();
      if (!this.worklet || this.failure)
        throw new Error(this.failure || "Audio processing is unavailable");
      if (
        action.replaceId &&
        !this.config.profiles.some((p) => p.id === action.replaceId)
      )
        throw new Error("Unknown profile to retest");
      this.session = new PersonalProtocol(action.replaceId);
      return { ...this.session.state };
    }
    const session = this.session;
    if (!session || session.state.id !== action.id)
      throw new Error("Sound setup is no longer active");
    if (action.op === "cancel") {
      this.stop();
      session.cancel();
      return { ...session.state };
    }
    session.heartbeat();
    switch (action.op) {
      case "pulse":
        this.play(session.pulse());
        break;
      case "respond":
        session.respond(action.heard);
        break;
      case "retry":
        this.stop();
        session.retry();
        break;
      case "preview": {
        const p = session.preview(action.mode, action.strength);
        this.play(renderComparison(p.profile, p.strength, p.mode));
        break;
      }
      case "save": {
        if (
          !Number.isFinite(action.strength) ||
          action.strength < 0 ||
          action.strength > 100
        )
          throw new Error("Invalid profile strength");
        session.state.strength = action.strength;
        const profile = session.profile(action.name);
        await this.configure(
          {
            ...this.config,
            profiles: [
              ...this.config.profiles.filter((p) => p.id !== profile.id),
              profile,
            ],
            profileId: profile.id,
            personalEnabled: true,
            strength: session.state.strength,
          },
          true,
        );
        this.stop();
        session.state.phase = "saved";
        session.discard();
        break;
      }
    }
    return { ...session.state };
  }
}
