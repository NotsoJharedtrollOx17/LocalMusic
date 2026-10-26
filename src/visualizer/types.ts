export type VisualizerMode = "spectrum" | "geometry" | "xmb";
export interface VisualizerCapabilities {
  fftSize: number;
  bands: number;
  waveformPoints: number;
  maxUpdatesPerSecond: number;
  postEffects: boolean;
}
export const visualizerCapabilities: VisualizerCapabilities = {
  fftSize: 2048,
  bands: 64,
  waveformPoints: 256,
  maxUpdatesPerSecond: 30,
  postEffects: true,
};
export interface VisualizerSession {
  id: string;
  capabilities: VisualizerCapabilities;
}
export interface VisualizerFrame {
  generation: number;
  sequence: number;
  positionMs: number;
  sampleRate: number;
  spectrum: number[];
  waveform: number[];
  rms: number;
  bass: number;
  mid: number;
  treble: number;
  onset: number;
}
export const FFT_SIZE = 2048;
export const BANDS = 64;
export const WAVE_POINTS = 256;
export const emptyFrame = (): VisualizerFrame => ({
  generation: 0,
  sequence: 0,
  positionMs: 0,
  sampleRate: 48000,
  spectrum: Array(BANDS).fill(0),
  waveform: Array(WAVE_POINTS).fill(0),
  rms: 0,
  bass: 0,
  mid: 0,
  treble: 0,
  onset: 0,
});
