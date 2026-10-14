import { expect, it } from "vitest";
import { PersonalProtocol, deriveCurve } from "./personal";
import { setupPreview } from "./setupPreview";

it("shows a pending No immediately without changing the actual response or other ear", () => {
  const p = new PersonalProtocol();
  const shown = setupPreview(p.state, undefined, true);
  expect(shown.left[5]).toBe(6);
  expect(shown.right).toEqual(Array(10).fill(0));
  expect(p.state.left).toEqual(Array(10).fill(0));
  expect(p.state.level).toBe(-54);
  p.state.level = -48;
  expect(setupPreview(p.state).left).toEqual(shown.left);
});

it("uses the confirmed reference for the candidate and isolates right-ear adjustments", () => {
  const p = new PersonalProtocol();
  Object.assign(p.state, {
    ear: 1,
    step: 1,
    frequency: 250,
    level: -48,
    left: Array(10).fill(2),
  });
  expect(setupPreview(p.state, -48).right[3]).toBe(0);
  const shown = setupPreview(p.state, -48, true);
  expect(shown.right[3]).toBe(6);
  expect(shown.left).toEqual(Array(10).fill(2));
  expect(p.state.right).toEqual(Array(10).fill(0));
});

it("discards provisional boosts from completed/unknown results", () => {
  const p = new PersonalProtocol();
  p.state.left = deriveCurve([-54, null, -54, -54, -54, -54]);
  Object.assign(p.state, { frequency: 250, step: 1, level: -36 });
  expect(setupPreview(p.state, -54).left[3]).toBe(6);
  p.state.phase = "compare";
  expect(setupPreview(p.state, -54, true).left[3]).toBe(0);
  p.cancel();
  expect(setupPreview(p.state, -54, true).left).toEqual(Array(10).fill(0));
});
