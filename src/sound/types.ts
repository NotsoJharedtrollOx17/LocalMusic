export const FREQUENCIES = [
  31, 63, 125, 250, 500, 1000, 2000, 4000, 8000, 16000,
] as const;
// Index zero is retained only for reading old ten-slot configurations.
export const EQ_BANDS = FREQUENCIES.slice(1).map((frequency, offset) => ({
  frequency,
  index: offset + 1,
}));
export interface SoundPreset {
  id: string;
  name: string;
  gains: number[];
  preamp: number;
}
export interface SoundConfig {
  version: 2;
  enabled: boolean;
  gains: number[];
  preamp: number;
  presetId: string;
  presets: SoundPreset[];
}
export type SoundStatus =
  "ready" | "activation" | "active" | "output-unavailable" | "failed";
export interface SoundState {
  supported: boolean;
  config: SoundConfig;
  status: SoundStatus;
  reason?: string;
  sampleRate: number;
  channels: number;
  attenuation: number;
  bypass: boolean;
  inactiveBands: number[];
  routeMonitoring: boolean;
  migrationNotice?: string;
}
export type SoundAction = { op: "retry" } | { op: "bypass"; value: boolean };
