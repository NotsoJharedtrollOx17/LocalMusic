import { SoundProcessor, type Coefficients } from "./dsp";
import { VisualizerCapture } from "../visualizer/capture.worklet";
declare const sampleRate: number;
declare const currentTime: number;
declare function registerProcessor(name: string, processor: unknown): void;
declare class AudioWorkletProcessor {
  port: MessagePort;
}
class MusicSoundProcessor extends AudioWorkletProcessor {
  private dsp = new SoundProcessor(sampleRate);
  private capture = new VisualizerCapture();
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
        visualizerPort?: MessagePort;
        visualizerUntil?: number;
        visualizerOffset?: number;
        visualizerStop?: boolean;
      };
    }) => {
      if (
        data.visualizerPort ||
        data.visualizerUntil !== undefined ||
        data.visualizerStop
      ) {
        try {
          this.capture.configure(data, sampleRate);
        } catch {
          this.capture.configure({ visualizerStop: true }, sampleRate);
        }
      } else if (data.reset) this.dsp.reset();
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
    try {
      this.capture.capture(output, currentTime, sampleRate);
    } catch {
      this.capture.configure({ visualizerStop: true }, sampleRate);
    }
    return true;
  }
}
registerProcessor("music-sound", MusicSoundProcessor);
