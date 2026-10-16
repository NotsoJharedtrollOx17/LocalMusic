import type { ResponseEstimate } from "./types";

export const CALIBRATION_FREQUENCIES = [1000, 250, 500, 2000, 4000, 8000];
export const CALIBRATION_LEVELS = [-72, -66, -60, -54, -48, -42, -36];
export const TOTAL_TRIALS = 36;
const level = (index: number) => -72 + index * 6;

/** Original bounded preference estimator. No audio, timers or storage work here. */
export class Calibration {
  answered = 0;
  private cells = Array.from({ length: 12 }, () => ({
    lower: -1,
    upper: 7,
    answered: 0,
  }));
  get ear() {
    return this.answered % 2;
  }
  get step() {
    return Math.min(5, Math.floor(this.answered / 6));
  }
  get done() {
    return this.answered === TOTAL_TRIALS;
  }
  get level() {
    const c = this.cells[this.ear * 6 + this.step];
    return level(Math.floor((c.lower + c.upper) / 2));
  }
  answer(heard: boolean) {
    if (this.done) throw new Error("Calibration is complete");
    const c = this.cells[this.ear * 6 + this.step];
    const index = Math.floor((c.lower + c.upper) / 2);
    if (heard) c.upper = index;
    else c.lower = index;
    c.answered++;
    this.answered++;
  }
  estimates(): ResponseEstimate[] {
    return this.cells.map((c, i) => {
      const status = !c.answered
        ? "untested"
        : c.answered < 3
          ? "estimating"
          : c.lower === -1
            ? "below-floor"
            : c.upper === 7
              ? "above-ceiling"
              : "bracketed";
      return {
        ear: Math.floor(i / 6),
        frequency: CALIBRATION_FREQUENCIES[i % 6],
        status,
        estimateDbfs:
          status === "untested" ||
          status === "below-floor" ||
          status === "above-ceiling"
            ? null
            : Math.max(
                -72,
                Math.min(-36, (level(c.lower) + level(c.upper)) / 2),
              ),
        lowerDbfs: c.lower < 0 ? null : level(c.lower),
        upperDbfs: c.upper > 6 ? null : level(c.upper),
        answered: c.answered,
      };
    });
  }
  values(ear: number) {
    return this.estimates()
      .slice(ear * 6, ear * 6 + 6)
      .map((e) => (e.status === "bracketed" ? e.estimateDbfs : null));
  }
  reset() {
    this.answered = 0;
    this.cells = Array.from({ length: 12 }, () => ({
      lower: -1,
      upper: 7,
      answered: 0,
    }));
  }
}
