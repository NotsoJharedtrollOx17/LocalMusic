import { emptyFrame, type VisualizerFrame, type VisualizerMode } from "./types";
import { originTrajectory, spatialNoise } from "./attractor";

export class VisualizerRenderer {
  private context: CanvasRenderingContext2D;
  private values = new Float32Array(64);
  private peaks = new Float32Array(64);
  private waveform = new Float32Array(256);
  private gradient?: CanvasGradient;
  private trajectory?: Float32Array;
  private dark = false;
  private background = "#faf8f4";
  private colors = ["#d85113", "#c87a3b", "#648f9e", "#237eb4", "#2462b9"];
  private width = 0;
  private height = 0;
  private phase = 0;
  private energy = 0;
  private presence = 0;
  fps = 60;
  private cap = 2_000_000;
  private windowStart = 0;
  private work = 0;
  private misses = 0;
  private count = 0;
  private stableSince = 0;
  get moving() {
    return (
      (this.presence > 0 && this.presence < 1) ||
      this.energy > 0.0001 ||
      this.peaks.some((v) => v > 0.002)
    );
  }
  readonly metrics = { frames: 0, drawMs: 0, maxDrawMs: 0, downgraded: false };
  constructor(private canvas: HTMLCanvasElement) {
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) throw new Error("Canvas unavailable");
    this.context = context;
  }
  setTheme(dark: boolean) {
    if (dark === this.dark && this.gradient) return;
    this.dark = dark;
    this.background = dark ? "#141615" : "#faf8f4";
    this.colors = dark
      ? ["#ff873d", "#e9a567", "#8dbfc4", "#55aee8", "#6c8fe8"]
      : ["#d85113", "#c87a3b", "#648f9e", "#237eb4", "#2462b9"];
    this.makeGradient();
  }
  private makeGradient() {
    this.gradient = this.context.createLinearGradient(
      this.width * 0.08,
      0,
      this.width * 0.92,
      0,
    );
    this.colors.forEach((color, i) =>
      this.gradient!.addColorStop(i / 4, color),
    );
  }
  resize() {
    const rect = this.canvas.getBoundingClientRect();
    const ratio = Math.min(
      1.5,
      window.devicePixelRatio || 1,
      Math.sqrt(this.cap / Math.max(1, rect.width * rect.height)),
    );
    const w = Math.max(1, Math.floor(rect.width * ratio)),
      h = Math.max(1, Math.floor(rect.height * ratio));
    if (w === this.width && h === this.height) return;
    this.canvas.width = this.width = w;
    this.canvas.height = this.height = h;
    this.makeGradient();
  }
  draw(
    mode: VisualizerMode,
    frame: VisualizerFrame | null,
    dt: number,
    animate: boolean,
    now: number,
    sceneReady = true,
    gentleMotion = false,
    scenePlaying = true,
  ) {
    const start = performance.now();
    const c = this.context,
      w = this.width,
      h = this.height,
      f = frame ?? empty;
    c.fillStyle = this.background;
    c.fillRect(0, 0, w, h);
    if (!sceneReady) {
      this.presence = 0;
      this.energy = 0;
      this.values.fill(0);
      this.peaks.fill(0);
      this.waveform.fill(0);
      return;
    }
    this.presence = scenePlaying
      ? Math.min(1, this.presence + dt / 0.18)
      : Math.max(0, this.presence - dt / (gentleMotion ? 0.5 : 0.36));
    const settle = this.presence * this.presence * (3 - 2 * this.presence);
    if (!this.presence) {
      this.energy = 0;
      this.values.fill(0);
      this.peaks.fill(0);
    }
    const motion = gentleMotion ? 0.2 : 1;
    const a = animate ? 1 - Math.exp(-dt * (gentleMotion ? 6 : 14)) : 1;
    this.energy += ((animate ? f.rms : 0) - this.energy) * a;
    if (animate && scenePlaying && this.energy > 0.0001)
      this.phase += dt * Math.min(1.6, 0.1 + this.energy * 3) * motion;
    for (let i = 0; i < 64; i++) {
      const target = animate ? (f.spectrum[i] ?? 0) : 0;
      this.values[i] +=
        (target - this.values[i]) *
        (target > this.values[i] ? a : 1 - Math.exp(-dt * 5));
      this.peaks[i] = Math.max(this.values[i], this.peaks[i] - dt * 0.18);
    }
    for (let i = 0; i < 256; i++)
      this.waveform[i] +=
        ((animate ? (f.waveform[i] ?? 0) : 0) - this.waveform[i]) * a;
    let bass = 0,
      mid = 0,
      treble = 0;
    for (let i = 0; i < 64; i++) {
      if (i < 20) bass = Math.max(bass, this.values[i]);
      else if (i < 42) mid = Math.max(mid, this.values[i]);
      else treble = Math.max(treble, this.values[i]);
    }
    c.lineWidth = Math.max(1, w / 1100);
    c.strokeStyle = this.dark ? "#343832" : "#dfddd6";
    if (mode === "spectrum") {
      const gap = w * 0.002,
        bw = (w * 0.84) / 64,
        baseline = h * 0.76;
      c.beginPath();
      c.moveTo(w * 0.08, baseline + 3);
      c.lineTo(w * 0.92, baseline + 3);
      c.stroke();
      for (let i = 0; i < 64; i++) {
        const x = w * 0.08 + i * bw,
          bar = Math.max(2, this.values[i] * h * 0.48) * settle;
        c.fillStyle = this.gradient!;
        c.fillRect(x, baseline - bar, Math.max(1, bw - gap), bar);
        c.fillStyle = this.gradient!;
        c.fillRect(
          x,
          baseline - (this.peaks[i] * h * 0.48 + 5) * settle,
          Math.max(1, bw - gap),
          Math.max(1, h * 0.002) * settle,
        );
      }
    } else if (mode === "geometry") {
      if (!settle) return;
      // The original artwork projects both position axes from x, while y/z
      // determine rectangle dimensions. Keep that distinctive nested structure.
      const points = (this.trajectory ??= originTrajectory());
      const head = 160 + this.phase * 90;
      const rotation = this.phase * 0.2;
      const cy = Math.cos(rotation * 0.7 + mid * this.energy * 0.15 * motion);
      const cz = Math.cos(rotation),
        sz = Math.sin(rotation);
      const scale =
        Math.min(w, h) *
        settle *
        1.25 *
        (0.007 + bass * this.energy * 0.003 * motion);
      for (let i = 0; i < 60; i++) {
        // Ping-pong a finite deterministic orbit, avoiding a discontinuous wrap.
        const travel = (head + i) % 15998;
        const index = travel < 7999 ? travel : 15998 - travel;
        const lo = Math.floor(index),
          fraction = index - lo;
        const hi = Math.min(7999, lo + 1);
        const x = points[lo * 3] + (points[hi * 3] - points[lo * 3]) * fraction;
        const y =
          points[lo * 3 + 1] +
          (points[hi * 3 + 1] - points[lo * 3 + 1]) * fraction;
        const z =
          points[lo * 3 + 2] +
          (points[hi * 3 + 2] - points[lo * 3 + 2]) * fraction;
        const origin = x + spatialNoise(x);
        const rw = y + spatialNoise(y);
        const rh = z * spatialNoise(z);
        c.strokeStyle =
          this.colors[Math.min(4, Math.floor(i / 12))] +
          (this.dark ? "a6" : "85");
        c.fillStyle = this.colors[Math.min(4, Math.floor(i / 12))] + "04";
        c.lineWidth =
          Math.max(0.75, w / 1400) * (1 + treble * this.energy * 0.5 * motion);
        c.beginPath();
        for (let corner = 0; corner < 4; corner++) {
          const px = origin + (corner === 1 || corner === 2 ? rw : 0);
          const py = origin + (corner >= 2 ? rh : 0) - 12;
          // Orthographic Y/Z rotation follows the p5 scene, with bounded audio tilt.
          const rx = px * cy;
          const sx = (rx * cz - py * sz) * scale + w / 2;
          const sy2 = (rx * sz + py * cz) * scale + h * 0.46;
          if (corner) c.lineTo(sx, sy2);
          else c.moveTo(sx, sy2);
        }
        c.closePath();
        c.fill();
        c.stroke();
      }
    } else {
      // Four layers use a bounded 384-point budget (four x 96).
      // Counter-moving harmonics and distinct layer rates create depth.
      for (let ribbon = 0; ribbon < 4; ribbon++) {
        c.beginPath();
        const travel =
          this.phase * (0.24 + ribbon * 0.19) * (ribbon % 2 ? -1 : 1);
        const offset = ribbon * 1.37;
        for (let i = 0; i < 96; i++) {
          const point = i < 48 ? i : 95 - i,
            x = point / 47;
          const amplitude =
            (0.065 + ribbon * 0.009) *
            (1 + this.energy * (1.6 + bass) * motion);
          const y =
            0.5 +
            (0.4 + ribbon * 0.045 - 0.5) * settle +
            amplitude *
              settle *
              (0.68 * Math.sin(x * Math.PI * 2.15 - travel + offset) +
                0.24 *
                  Math.sin(x * Math.PI * 4.4 + travel * 0.62 + offset * 1.4) +
                0.08 * Math.cos(x * Math.PI * 7.1 - travel * 0.41)) +
            (i < 48 ? -1 : 1) *
              settle *
              (0.007 +
                0.012 * Math.sin(x * Math.PI + travel * 0.2) ** 2 +
                mid * this.energy * 0.025 * motion);
          if (i) c.lineTo(x * w, y * h);
          else c.moveTo(x * w, y * h);
        }
        c.strokeStyle =
          this.colors[ribbon === 0 ? 0 : ribbon + 1] +
          (this.dark ? "99" : "85");
        c.lineWidth = Math.max(1, w / 1000);
        c.closePath();
        c.fillStyle = this.colors[ribbon === 0 ? 0 : ribbon + 1] + "09";
        c.fill();
        c.stroke();
      }
      if (animate && scenePlaying && this.energy > 0.0001)
        for (let i = 0; i < 12; i++) {
          const x = ((i / 12 + this.phase * 0.015) % 1) * w,
            y = h * (0.44 + 0.1 * Math.sin(i + this.phase));
          c.fillStyle = this.colors[i % 5] + "70";
          c.fillRect(x, y, 2 + treble * 2, 2);
        }
    }
    const work = performance.now() - start;
    this.metrics.frames++;
    this.metrics.drawMs += work;
    this.metrics.maxDrawMs = Math.max(this.metrics.maxDrawMs, work);
    this.count++;
    this.work += work;
    if (dt > (1 / this.fps) * 1.4) this.misses++;
    if (now - this.windowStart >= 2000 && this.count > 5) {
      const bad =
        this.work / this.count > (this.fps === 60 ? 8 : 16) ||
        this.misses / this.count > 0.05;
      if (bad) {
        this.stableSince = now;
        if (this.fps === 60) this.fps = 30;
        else if (this.cap > 1_000_000) {
          this.cap = 1_000_000;
          this.resize();
        }
        this.metrics.downgraded = true;
      } else if (now - this.stableSince > 10000) {
        if (this.cap < 2_000_000) {
          this.cap = 2_000_000;
          this.resize();
        } else this.fps = 60;
        this.stableSince = now;
      }
      this.windowStart = now;
      this.count = this.work = this.misses = 0;
    }
  }
}
const empty = emptyFrame();
