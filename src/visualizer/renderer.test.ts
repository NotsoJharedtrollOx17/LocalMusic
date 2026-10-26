import { it, expect, vi, afterEach } from "vitest";
import { VisualizerRenderer } from "./renderer";
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
it("bounds pixels and uses 60/30 fps and resolution hysteresis", () => {
  vi.stubGlobal("window", { devicePixelRatio: 3 });
  const context = {
    createLinearGradient: () => ({ addColorStop() {} }),
    fillRect() {},
    beginPath() {},
    moveTo() {},
    lineTo() {},
    stroke() {},
    closePath() {},
    fill() {},
    translate() {},
    setTransform() {},
  };
  const canvas = {
    width: 0,
    height: 0,
    getContext: () => context,
    getBoundingClientRect: () => ({ width: 1200, height: 800 }),
  } as unknown as HTMLCanvasElement;
  const render = new VisualizerRenderer(canvas);
  render.resize();
  expect(canvas.width * canvas.height).toBeLessThanOrEqual(2_000_000);
  let clock = 0,
    calls = 0,
    cost = 9,
    now = 0;
  vi.spyOn(performance, "now").mockImplementation(() => {
    if (calls++ % 2 === 0) return clock;
    clock += cost;
    return clock;
  });
  const step = (seconds: number) => {
    const until = now + seconds * 1000;
    while (now < until) {
      const dt = 1 / render.fps;
      now += dt * 1000;
      render.draw("spectrum", null, dt, true, now);
    }
  };
  step(2.2);
  expect(render.fps).toBe(30);
  cost = 20;
  step(2.2);
  expect(canvas.width * canvas.height).toBeLessThanOrEqual(1_000_000);
  cost = 0.1;
  step(8);
  expect(render.fps).toBe(30);
  expect(canvas.width * canvas.height).toBeLessThanOrEqual(1_000_000);
  step(16);
  expect(render.fps).toBe(60);
  expect(canvas.width * canvas.height).toBeGreaterThan(1_000_000);
});
