import { emptyFrame, type VisualizerFrame, type VisualizerMode } from "./types";

export class VisualizerRenderer {
  private context: CanvasRenderingContext2D;
  private values = new Float32Array(64);
  private peaks = new Float32Array(64);
  private waveform = new Float32Array(256);
  private gradient?: CanvasGradient;
  private width = 0;
  private height = 0;
  private phase = 0;
  private energy = 0;
  fps = 60;
  private cap = 2_000_000;
  private windowStart = 0;
  private work = 0;
  private misses = 0;
  private count = 0;
  private stableSince = 0;
  get moving() {
    return this.energy > 0.0001 || this.peaks.some((v) => v > 0.002);
  }
  readonly metrics = { frames: 0, drawMs: 0, maxDrawMs: 0, downgraded: false };
  constructor(private canvas: HTMLCanvasElement) {
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) throw new Error("Canvas unavailable");
    this.context = context;
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
    this.gradient = this.context.createLinearGradient(0, h * 0.2, 0, h * 0.85);
    this.gradient.addColorStop(0, "#ffb46b");
    this.gradient.addColorStop(0.5, "#ff650d");
    this.gradient.addColorStop(1, "#87300c");
  }
  draw(
    mode: VisualizerMode,
    frame: VisualizerFrame | null,
    dt: number,
    animate: boolean,
    now: number,
  ) {
    const start = performance.now();
    const c = this.context,
      w = this.width,
      h = this.height,
      f = frame ?? empty;
    c.fillStyle = "#141617";
    c.fillRect(0, 0, w, h);
    const a = animate ? 1 - Math.exp(-dt * 14) : 1;
    this.energy += ((animate ? f.rms : 0) - this.energy) * a;
    if (animate && this.energy > 0.0001)
      this.phase += dt * Math.min(1.6, 0.1 + this.energy * 3);
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
    c.strokeStyle = "#343130";
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
          bar = Math.max(2, this.values[i] * h * 0.48);
        c.fillStyle = this.gradient!;
        c.fillRect(x, baseline - bar, Math.max(1, bw - gap), bar);
        c.fillStyle = "#ffc48c";
        c.fillRect(
          x,
          baseline - this.peaks[i] * h * 0.48 - 5,
          Math.max(1, bw - gap),
          Math.max(1, h * 0.002),
        );
      }
    } else if (mode === "geometry") {
      const radius = Math.min(w, h) * (0.18 + bass * this.energy * 0.4),
        phase = this.phase;
      c.translate(w / 2, h / 2);
      for (let ribbon = 0; ribbon < 4; ribbon++) {
        c.strokeStyle = ribbon % 2 ? "#ff9c514d" : "#ff650d99";
        c.beginPath();
        for (let i = 0; i < 128; i++) {
          const t = (i / 127) * Math.PI * 2,
            signal = this.waveform[(i * 2) % 256];
          const r =
            radius *
              (1 + 0.12 * Math.sin(t * 3 + phase + ribbon) + signal * 0.3) +
            ribbon * 6;
          const x = Math.cos(t + phase * 0.15) * r * (1 + mid * this.energy),
            y = Math.sin(t * 2 + phase * 0.3 + mid * this.energy * 0.5) * r;
          if (i) c.lineTo(x, y);
          else c.moveTo(x, y);
        }
        c.closePath();
        c.stroke();
      }
      c.setTransform(1, 0, 0, 1, 0, 0);
    } else {
      for (let ribbon = 0; ribbon < 2; ribbon++) {
        c.beginPath();
        for (let i = 0; i < 96; i++) {
          const point = i < 48 ? i : 95 - i,
            x = point / 47,
            travel = this.phase * (ribbon ? 0.48 : 0.38),
            phase = ribbon ? 1.75 : 0.15;
          const amplitude =
            (ribbon ? 0.09 : 0.105) *
            (1 + this.energy * 2 + bass * this.energy);
          const y =
            (ribbon ? 0.56 : 0.43) +
            amplitude *
              (0.68 * Math.sin(x * Math.PI * 2.15 - travel + phase) +
                0.24 *
                  Math.sin(x * Math.PI * 4.4 + travel * 0.62 + phase * 1.4) +
                0.08 * Math.cos(x * Math.PI * 7.1 - travel * 0.41)) +
            (i < 48 ? -1 : 1) *
              (0.012 +
                0.015 * Math.sin(x * Math.PI + this.phase * 0.1) ** 2 +
                mid * this.energy * 0.04);
          if (i) c.lineTo(x * w, y * h);
          else c.moveTo(x * w, y * h);
        }
        c.strokeStyle = ribbon ? "#ff9349b3" : "#ff650d66";
        c.lineWidth = ribbon ? 2 : 1;
        c.closePath();
        c.stroke();
        c.fillStyle = ribbon ? "#ff650d0d" : "#ff650d08";
        c.fill();
      }
      if (animate && this.energy > 0.0001)
        for (let i = 0; i < 12; i++) {
          const x = ((i / 12 + this.phase * 0.015) % 1) * w,
            y = h * (0.44 + 0.1 * Math.sin(i + this.phase));
          c.fillStyle = "#ffae6455";
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
