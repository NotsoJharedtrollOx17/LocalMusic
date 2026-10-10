import {
  FREQUENCIES,
  type PersonalProfile,
  type PersonalSession,
} from "./types";
export const TEST_FREQUENCIES = [1000, 250, 500, 2000, 4000, 8000, 1000];
const LEVELS = [-54, -48, -42, -36];
export function deriveCurve(values: (number | null)[]) {
  const fs = [250, 500, 1000, 2000, 4000, 8000],
    indexes = [1, 2, 0, 3, 4, 5],
    ref = values[0];
  return FREQUENCIES.map((f) => {
    if (ref === null || f < 250 || f > 8000) return 0;
    const i = fs.findIndex((v) => v >= f),
      j = Math.max(0, i - 1),
      a = values[indexes[j]],
      b = values[indexes[i]];
    if (f === fs[i]) return b == null ? 0 : Math.max(0, Math.min(6, b - ref));
    if (a === null || b === null) return 0;
    const t = i === j ? 0 : Math.log(f / fs[j]) / Math.log(fs[i] / fs[j]);
    return Math.max(0, Math.min(6, a + (b - a) * t - ref));
  });
}
/** Stateful protocol, independent from React and catalog playback. */
export class PersonalProtocol {
  state: PersonalSession = {
    id: crypto.randomUUID(),
    phase: "test",
    ear: 0,
    step: 0,
    frequency: 1000,
    level: -54,
    awaiting: false,
    busyUntil: 0,
    message: "",
    strength: 50,
    left: Array(10).fill(0),
    right: Array(10).fill(0),
  };
  private values: (number | null)[][] = [
    Array(6).fill(null),
    Array(6).fill(null),
  ];
  private lease = performance.now() + 2000;
  private end = 0;
  private nextPulse = 0;
  constructor(private readonly replaceId?: string) {}
  alive() {
    if (performance.now() > this.lease && this.state.phase !== "saved")
      this.cancel();
    return this.state.phase !== "cancelled";
  }
  heartbeat() {
    if (!this.alive()) throw new Error("Sound setup expired. Start again.");
    this.lease = performance.now() + 2000;
  }
  profile(name: string): PersonalProfile {
    if (this.state.phase !== "compare")
      throw new Error("Finish both ears first");
    if (!name.trim() || name.length > 60)
      throw new Error("Use a name between 1 and 60 characters");
    return {
      id: this.replaceId ?? crypto.randomUUID(),
      name: name.trim(),
      left: deriveCurve(this.values[0]),
      right: deriveCurve(this.values[1]),
      complete: this.values.flat().map((x) => x !== null),
    };
  }
  pulse() {
    this.heartbeat();
    if (this.state.phase !== "test" || performance.now() < this.nextPulse)
      throw new Error("Wait before playing another tone");
    this.end = performance.now() + 3400;
    this.nextPulse = this.end + 500;
    this.state.awaiting = true;
    this.state.busyUntil = Date.now() + 3400;
    return tone(this.state.frequency, this.state.level, this.state.ear);
  }
  respond(heard: boolean) {
    this.heartbeat();
    if (
      this.state.phase !== "test" ||
      !this.state.awaiting ||
      performance.now() < this.end
    )
      throw new Error("Play the tone and wait for it to finish first");
    this.state.awaiting = false;
    if (!heard && this.state.level < -36) {
      this.state.level = LEVELS[LEVELS.indexOf(this.state.level) + 1];
      return;
    }
    const s = this.state,
      value = heard ? s.level : null;
    if (s.step === 0 && value === null) {
      s.phase = "retry";
      s.message = "reference-unheard";
      return;
    }
    if (s.step < 6) this.values[s.ear][s.step] = value;
    else if (
      value === null ||
      Math.abs(value - (this.values[s.ear][0] ?? 0)) > 6
    ) {
      s.phase = "retry";
      s.message = "reference-inconsistent";
      return;
    }
    s.left = deriveCurve(this.values[0]);
    s.right = deriveCurve(this.values[1]);
    if (s.step === 6) {
      if (s.ear === 1) {
        s.phase = "compare";
        return;
      }
      s.ear = 1;
      s.step = 0;
    } else s.step++;
    s.frequency = TEST_FREQUENCIES[s.step];
    s.level = -54;
  }
  retry() {
    this.heartbeat();
    this.values[this.state.ear] = Array(6).fill(null);
    this.state.left = deriveCurve(this.values[0]);
    this.state.right = deriveCurve(this.values[1]);
    Object.assign(this.state, {
      phase: "test",
      step: 0,
      frequency: 1000,
      level: -54,
      awaiting: false,
      message: "",
    });
  }
  preview(mode: "original" | "personal", strength: number) {
    this.heartbeat();
    if (
      this.state.phase !== "compare" ||
      !Number.isFinite(strength) ||
      strength < 0 ||
      strength > 100
    )
      throw new Error("Invalid sound comparison");
    this.state.strength = strength;
    return { profile: this.profile("Preview"), mode, strength };
  }
  cancel() {
    this.state.phase = "cancelled";
    this.state.awaiting = false;
    this.values = [[], []];
    this.state.left = Array(10).fill(0);
    this.state.right = Array(10).fill(0);
  }
  discard() {
    this.values = [[], []];
    this.state.left = Array(10).fill(0);
    this.state.right = Array(10).fill(0);
  }
}
export function tone(
  frequency: number,
  level: number,
  ear: number,
  rate = 48000,
): Float32Array {
  if (
    !TEST_FREQUENCIES.includes(frequency) ||
    !LEVELS.includes(level) ||
    ![0, 1].includes(ear) ||
    rate <= frequency * 2
  )
    throw new Error("Invalid test tone");
  const frames = Math.round(rate * 3.4),
    out = new Float32Array(frames * 2),
    amplitude = 10 ** (level / 20);
  for (let i = 0; i < frames; i++) {
    const local = i % Math.round(rate * 1.3);
    if (local >= Math.round(rate * 0.8)) continue;
    const fade = Math.min(
      1,
      local / (rate * 0.1),
      (Math.round(rate * 0.8) - 1 - local) / (rate * 0.1),
    );
    out[i * 2 + ear] =
      Math.sin((2 * Math.PI * frequency * local) / rate) *
      amplitude *
      Math.max(0, fade);
  }
  return out;
}
export function comparisonSample(rate = 48000) {
  const frames = rate * 4,
    out = new Float32Array(frames * 2),
    notes = [220, 261.63, 329.63, 293.66];
  for (let i = 0; i < frames; i++) {
    const t = i / rate,
      local = t % 1,
      env = Math.min(1, local / 0.05, (1 - local) / 0.1),
      f = notes[Math.floor(t)];
    const sample =
      (Math.sin(2 * Math.PI * f * t) +
        0.3 * Math.sin(2 * Math.PI * f * 2 * t) +
        0.15 * Math.sin(2 * Math.PI * f * 4 * t)) *
      0.025 *
      env;
    out[i * 2] = out[i * 2 + 1] = sample;
  }
  return out;
}
