import { describe, it, expect, vi, afterEach } from "vitest";
import fixtures from "../../tests/fixtures/sound-calibration.json";
import { Calibration } from "./calibration";
import { PersonalProtocol } from "./PersonalProtocol";
import { deriveCurve } from "./personal";
afterEach(() => vi.restoreAllMocks());
describe("bounded calibration shared fixtures", () => {
  for (const fixture of fixtures.paths)
    it(`resolves ${fixture.answers}`, () => {
      const c = new Calibration();
      for (let i = 0; i < 3; i++) {
        expect(c.level).toBe(fixture.levels[i]);
        c.answer(fixture.answers[i]);
        c.answer(fixture.answers[i]); // alternating other ear
      }
      expect(c.estimates()[0]).toMatchObject({
        status: fixture.status,
        estimateDbfs: fixture.estimateDbfs,
        lowerDbfs: fixture.lowerDbfs,
        upperDbfs: fixture.upperDbfs,
        answered: 3,
      });
    });
  for (const fixture of fixtures.sessions)
    it(fixture.name, () => {
      const c = new Calibration();
      fixture.answers.forEach((a, i) => {
        expect(c.ear).toBe(fixture.ears[i]);
        expect(c.level).toBe(fixture.levels[i]);
        c.answer(a);
      });
      expect(c.done).toBe(true);
      expect(c.answered).toBe(36);
      expect(() => c.answer(true)).toThrow();
      expect(deriveCurve(c.values(0))).toEqual(fixture.left);
      expect(deriveCurve(c.values(1))).toEqual(fixture.right);
      expect(c.estimates().map((e) => e.status)).toEqual(fixture.coverage);
    });
  it("rejects stale trials, duplicates, overlap and expired leases without inventing answers", () => {
    let now = 0;
    vi.spyOn(performance, "now").mockImplementation(() => now);
    const p = new PersonalProtocol(),
      trial = p.state.trialId;
    expect(() => p.pulse("old")).toThrow();
    expect(() => p.respond(true, trial)).toThrow();
    p.pulse(trial);
    expect(() => p.respond(true, trial)).toThrow();
    expect(() => p.pulse(trial)).toThrow();
    for (let i = 0; i < 4; i++) {
      now += 1000;
      p.heartbeat();
    }
    p.pulse(trial);
    expect(p.state.trialId).toBe(trial);
    expect(p.state.answeredTrials).toBe(0);
    for (let i = 0; i < 4; i++) {
      now += 1000;
      p.heartbeat();
    }
    p.respond(true, trial);
    expect(p.state.ear).toBe(1);
    expect(p.state.answeredTrials).toBe(1);
    expect(() => p.respond(true, trial)).toThrow();
    expect(() => p.pulse(trial)).toThrow();
    now += 2100;
    p.heartbeat();
    expect(p.state.phase).toBe("paused");
    expect(p.state.answeredTrials).toBe(1);
    const estimates = structuredClone(p.state.estimates);
    const pausedTrial = p.state.trialId;
    p.pause();
    expect(p.state.trialId).toBe(pausedTrial);
    now += 30000;
    p.heartbeat();
    expect(() => p.resume(trial)).toThrow();
    expect(() => p.pulse(pausedTrial)).toThrow();
    p.resume(pausedTrial);
    expect(p.state.phase).toBe("test");
    expect(p.state.estimates).toEqual(estimates);
    expect(p.state.answeredTrials).toBe(1);
    expect(() => p.resume(pausedTrial)).toThrow();
    expect(() => p.pulse(p.state.trialId)).toThrow();
    now += 500;
    p.pulse(p.state.trialId);
    p.cancel();
    expect(p.state.estimates).toEqual([]);
  });
  it("saves only derived curves and coverage; cancelled retests leave existing profiles untouched", () => {
    let now = 0;
    vi.spyOn(performance, "now").mockImplementation(() => now);
    const p = new PersonalProtocol("existing"),
      fixture = fixtures.sessions[3];
    fixture.answers.forEach((answer) => {
      const trial = p.state.trialId;
      p.pulse(trial);
      for (let i = 0; i < 4; i++) {
        now += 1000;
        p.heartbeat();
      }
      p.respond(answer, trial);
    });
    const saved = p.profile("Headphones");
    expect(saved.id).toBe("existing");
    expect(saved.left).toEqual(fixture.left);
    expect(saved.calibration).toEqual({
      method: "bounded-3-v1",
      coverage: fixture.coverage,
    });
    expect(Object.keys(saved).sort()).toEqual(
      ["id", "name", "left", "right", "complete", "calibration"].sort(),
    );
    const retest = new PersonalProtocol(saved.id);
    retest.cancel();
    expect(saved.left).toEqual(fixture.left);
    expect(() => retest.profile("Lost")).toThrow();
  });
});
