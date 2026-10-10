export const FREQUENCIES = [
  31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000,
] as const;
export interface SoundPreset {
  id: string;
  name: string;
  gains: number[];
  preamp: number;
}
export interface PersonalProfile {
  id: string;
  name: string;
  left: number[];
  right: number[];
  complete: boolean[];
}
export interface SoundConfig {
  version: 1;
  enabled: boolean;
  gains: number[];
  preamp: number;
  presetId: string;
  presets: SoundPreset[];
  profiles: PersonalProfile[];
  profileId: string | null;
  personalEnabled: boolean;
  strength: number;
}
export type SoundStatus =
  "ready" | "activation" | "active" | "output-unavailable" | "failed";
export interface SoundState {
  supported: boolean;
  systemPanel: boolean;
  config: SoundConfig;
  status: SoundStatus;
  reason?: string;
  sampleRate: number;
  channels: number;
  attenuation: number;
  bypass: boolean;
  inactiveBands: number[];
  personalAvailable: boolean;
  routeMonitoring: boolean;
  routeGeneration?: number;
  migrationNotice?: string;
}
export interface PersonalSession {
  left?: number[];
  right?: number[];
  id: string;
  phase: "test" | "retry" | "compare" | "saved" | "cancelled";
  ear: number;
  step: number;
  frequency: number;
  level: number;
  awaiting: boolean;
  busyUntil: number;
  message: string;
  strength: number;
}
export type PersonalAction =
  | { op: "start"; replaceId?: string }
  | { op: "pulse" | "heartbeat" | "retry" | "cancel"; id: string }
  | { op: "respond"; id: string; heard: boolean }
  | {
      op: "preview";
      id: string;
      mode: "original" | "personal";
      strength: number;
    }
  | { op: "save"; id: string; name: string; strength: number };
export type SoundAction =
  | { op: "profile-use"; id: string; routeGeneration: number }
  | { op: "retry" }
  | { op: "bypass"; value: boolean };
