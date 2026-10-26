import { it, expect, vi, afterEach } from "vitest";
import { VisualizerRenderer } from "./renderer";
import { emptyFrame } from "./types";
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
it("settles bars downward, collapses Geometry and flattens XMB without hiding the canvas", () => {
  vi.stubGlobal("window", { devicePixelRatio: 1 });
  for (const mode of ["spectrum", "geometry", "xmb"] as const) {
    let heights: number[] = [],
      ys: number[] = [],
      xs: number[] = [];
    const point = (x: number, y: number) => {
      xs.push(x);
      ys.push(y);
    };
    const context = {
      createLinearGradient: () => ({ addColorStop() {} }),
      fillRect: (_x: number, _y: number, width: number, height: number) => {
        if (width < 1000) heights.push(height);
      },
      beginPath() {},
      moveTo: point,
      lineTo: point,
      stroke() {},
      closePath() {},
      fill() {},
    };
    const canvas = {
      getContext: () => context,
      getBoundingClientRect: () => ({ width: 1000, height: 600 }),
    } as unknown as HTMLCanvasElement;
    const render = new VisualizerRenderer(canvas);
    render.resize();
    const frame = emptyFrame();
    frame.rms = 0.3;
    frame.spectrum.fill(0.8);
    const extent = () =>
      mode === "spectrum"
        ? Math.max(0, ...heights)
        : Math.max(...ys) - Math.min(...ys);
    const step = (playing: boolean) => {
      heights = [];
      xs = [];
      ys = [];
      render.draw(
        mode,
        playing ? frame : null,
        0.1,
        true,
        0,
        true,
        false,
        playing,
      );
    };
    for (let i = 0; i < 10; i++) step(true);
    const active = extent();
    expect(active).toBeGreaterThan(0);
    step(false);
    step(false);
    expect(extent()).toBeGreaterThan(0);
    expect(extent()).toBeLessThan(active * 0.7);
    for (let i = 0; i < 10; i++) step(false);
    if (mode === "geometry") expect(xs).toHaveLength(0);
    else if (mode === "xmb") expect(extent()).toBe(0);
    else expect(extent()).toBe(0);
    expect(render.moving).toBe(false);
    for (let i = 0; i < 10; i++) step(true);
    expect(extent()).toBeGreaterThan(0);
  }
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
