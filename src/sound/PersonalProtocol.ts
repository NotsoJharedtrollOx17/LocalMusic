import {
  Calibration,
  CALIBRATION_FREQUENCIES,
  TOTAL_TRIALS,
} from "./calibration";
import { deriveCurve, tone } from "./personal";
import type { PersonalProfile, PersonalSession } from "./types";

/** Lease and trial guards shared by every browser setup action. */
export class PersonalProtocol {
  private calibration = new Calibration();
  private lease = performance.now() + 2000;
  private end = 0;
  private nextPulse = 0;
  state: PersonalSession = {
    id: crypto.randomUUID(),
    trialId: crypto.randomUUID(),
    answeredTrials: 0,
    totalTrials: TOTAL_TRIALS,
    estimates: this.calibration.estimates(),
    phase: "test",
    ear: 0,
    step: 0,
    frequency: 1000,
    level: -54,
    awaiting: false,
    busyUntil: 0,
    message: "",
    strength: 100,
    left: Array(10).fill(0),
    right: Array(10).fill(0),
  };
  constructor(private readonly replaceId?: string) {}
  alive() {
    if (
      performance.now() > this.lease &&
      !["saved", "paused"].includes(this.state.phase)
    )
      this.pause();
    return this.state.phase !== "cancelled";
  }
  heartbeat() {
    if (!this.alive()) throw new Error("Sound setup expired. Start again.");
    this.lease = performance.now() + 2000;
  }
  pause() {
    if (!["test", "compare", "retry"].includes(this.state.phase)) return;
    this.state.resumePhase = this.state.phase as "test" | "compare" | "retry";
    this.state.phase = "paused";
    this.state.awaiting = false;
    this.state.busyUntil = 0;
    this.state.trialId = crypto.randomUUID();
  }
  resume(trialId: string) {
    if (
      this.state.phase !== "paused" ||
      !trialId ||
      trialId !== this.state.trialId
    )
      throw new Error("Stale sound setup pause");
    this.state.phase = this.state.resumePhase ?? "test";
    this.state.trialId = crypto.randomUUID();
    this.lease = performance.now() + 2000;
    this.nextPulse = performance.now() + 500;
    this.state.busyUntil = Date.now();
  }
  private checkTrial(trialId: string) {
    if (
      !trialId ||
      trialId !== this.state.trialId ||
      this.state.phase !== "test"
    )
      throw new Error("Stale sound setup trial");
  }
  pulse(trialId: string) {
    this.heartbeat();
    this.checkTrial(trialId);
    if (performance.now() < this.nextPulse)
      throw new Error("Wait before playing another tone");
    this.end = performance.now() + 3400;
    this.nextPulse = this.end + 500;
    this.state.awaiting = true;
    this.state.busyUntil = Date.now() + 3400;
    return tone(this.state.frequency, this.state.level, this.state.ear);
  }
  respond(heard: boolean, trialId: string) {
    this.heartbeat();
    this.checkTrial(trialId);
    if (!this.state.awaiting || performance.now() < this.end)
      throw new Error("Play the tone and wait for it to finish first");
    this.calibration.answer(heard);
    this.state.awaiting = false;
    this.state.trialId = this.calibration.done ? "" : crypto.randomUUID();
    this.state.answeredTrials = this.calibration.answered;
    this.state.estimates = this.calibration.estimates();
    this.state.left = deriveCurve(this.calibration.values(0));
    this.state.right = deriveCurve(this.calibration.values(1));
    if (this.calibration.done) this.state.phase = "compare";
    else {
      this.state.ear = this.calibration.ear;
      this.state.step = this.calibration.step;
      this.state.frequency = CALIBRATION_FREQUENCIES[this.state.step];
      this.state.level = this.calibration.level;
    }
  }
  retry() {
    this.heartbeat();
    this.calibration.reset();
    Object.assign(this.state, {
      phase: "test",
      trialId: crypto.randomUUID(),
      answeredTrials: 0,
      ear: 0,
      step: 0,
      frequency: 1000,
      level: -54,
      awaiting: false,
      message: "",
      estimates: this.calibration.estimates(),
      left: Array(10).fill(0),
      right: Array(10).fill(0),
    });
  }
  profile(name: string): PersonalProfile {
    if (this.state.phase !== "compare")
      throw new Error("Finish both ears first");
    if (!name.trim() || name.length > 60)
      throw new Error("Use a name between 1 and 60 characters");
    const coverage = this.calibration.estimates().map((e) => e.status);
    return {
      id: this.replaceId ?? crypto.randomUUID(),
      name: name.trim(),
      left: deriveCurve(this.calibration.values(0)),
      right: deriveCurve(this.calibration.values(1)),
      complete: coverage.map((s) => s === "bracketed"),
      calibration: { method: "bounded-3-v1", coverage },
    };
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
    this.state.trialId = "";
    this.discard();
  }
  discard() {
    this.calibration.reset();
    this.state.estimates = [];
    this.state.left = Array(10).fill(0);
    this.state.right = Array(10).fill(0);
  }
}
