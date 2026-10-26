/** Called only after the ordinary DSP filled its output. Never touches that output. */
export class VisualizerCapture {
  private port?: MessagePort;
  private free: Float32Array[] = [];
  private current?: Float32Array;
  private index = 0;
  private until = 0;
  private offset = 0;
  private frames = 1024;
  configure(
    data: {
      visualizerPort?: MessagePort;
      visualizerUntil?: number;
      visualizerOffset?: number;
      visualizerStop?: boolean;
    },
    rate: number,
  ) {
    if (data.visualizerStop) {
      this.port?.close();
      this.port = undefined;
      this.free = [];
      this.current = undefined;
      return;
    }
    if (data.visualizerUntil !== undefined) this.until = data.visualizerUntil;
    if (!data.visualizerPort) return;
    this.port?.close();
    this.port = data.visualizerPort;
    this.offset = data.visualizerOffset ?? 0;
    this.frames = Math.min(
      4096,
      Math.max(128, 2 ** Math.floor(Math.log2(rate / 30))),
    );
    this.free = Array.from(
      { length: 3 },
      () => new Float32Array(this.frames * 2),
    );
    this.current = undefined;
    this.index = 0;
    this.port.onmessage = ({ data }: MessageEvent<ArrayBuffer>) => {
      if (this.free.length < 3) this.free.push(new Float32Array(data));
    };
    this.port.start();
  }
  capture(output: Float32Array[], time: number, rate: number) {
    if (!this.port || time > this.until) return;
    for (let i = 0; i < output[0].length; i++) {
      if (!this.current) {
        this.current = this.free.pop();
        if (!this.current) return;
        this.index = 0;
      }
      let l = output[0][i],
        r = output[1]?.[i] ?? l;
      for (let ch = 2; ch < output.length; ch++) {
        const value = output[ch][i];
        if (ch % 2 === 0) {
          if (Math.abs(value) > Math.abs(l)) l = value;
        } else if (Math.abs(value) > Math.abs(r)) r = value;
      }
      this.current[this.index * 2] = l;
      this.current[this.index * 2 + 1] = r;
      if (++this.index === this.frames) {
        const buffer = this.current.buffer as ArrayBuffer;
        this.port.postMessage(
          {
            buffer,
            frames: this.frames,
            rate,
            positionMs: (time + (i + 1) / rate) * 1000 + this.offset,
          },
          [buffer],
        );
        this.current = undefined;
      }
    }
  }
}
