import { expect, it } from "vitest";
import { originTrajectory } from "./attractor";

it("preserves the artwork's initial state and Euler steps in a finite two-lobed trajectory", () => {
  const points = originTrajectory();
  expect(points.length).toBe(24000);
  expect(Array.from(points.slice(0, 3))).toEqual([expect.closeTo(0.11), 1, 1]);
  expect(points[3]).toBeCloseTo(0.11 + (10 * (1 - 0.11)) / 60);
  expect(points[4]).toBeCloseTo(1 + (0.11 * 27 - 1) / 60);
  expect(points[5]).toBeCloseTo(1 + (0.11 - 8 / 3) / 60);
  expect(points.every(Number.isFinite)).toBe(true);
  const xs = points.filter((_, i) => i % 3 === 0);
  expect(Math.min(...xs)).toBeLessThan(-10);
  expect(Math.max(...xs)).toBeGreaterThan(10);
  expect(Math.max(...points.map(Math.abs))).toBeLessThan(100);
});
