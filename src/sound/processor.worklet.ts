import { SoundProcessor, type Coefficients } from "./dsp";
declare const sampleRate: number;
declare function registerProcessor(name: string, processor: unknown): void;
declare class AudioWorkletProcessor {
  port: MessagePort;
}
class MusicSoundProcessor extends AudioWorkletProcessor {
  private dsp = new SoundProcessor(sampleRate);
  constructor() {
    super();
    this.port.onmessage = ({
      data,
    }: {
      data: {
        bank: Coefficients[][];
        gain: number;
        bypass: boolean;
        reset?: boolean;
      };
    }) => {
      if (data.reset) this.dsp.reset();
      else this.dsp.configure(data.bank, data.gain, data.bypass);
    };
  }
  process(inputs: Float32Array[][], outputs: Float32Array[][]) {
    const input = inputs[0],
      output = outputs[0];
    if (!output?.length) return true;
    for (let i = 0; i < output[0].length; i++) {
      const frame = output.map(
        (_, ch) => input?.[Math.min(ch, (input?.length ?? 1) - 1)]?.[i] ?? 0,
      );
      const result = this.dsp.process(frame);
      for (let ch = 0; ch < output.length; ch++) output[ch][i] = result[ch];
    }
    return true;
  }
}
registerProcessor("music-sound", MusicSoundProcessor);
