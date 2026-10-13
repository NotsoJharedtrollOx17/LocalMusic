import { FREQUENCIES, type SoundConfig, type SoundPreset } from "./types";
export const BUILT_INS: SoundPreset[] = [
  ["flat", "Normal", [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]],
  ["pop", "Pop", [-1, 0, 1, 2, 2, 1, 0, 0, 1, 2]],
  ["rock", "Rock", [3, 2, 1, -1, -2, -1, 1, 2, 3, 2]],
  ["jazz", "Jazz", [2, 1, 0, -1, 0, 1, 2, 2, 1, 0]],
  ["classical", "Classical", [2, 1, 0, 0, -1, 0, 1, 1, 2, 2]],
].map(([id, name, gains]) => ({
  id: id as string,
  name: name as string,
  gains: (gains as number[]).map((g, i) => (i === 0 ? 0 : g)),
  preamp: 0,
}));
export const defaultSound = (): SoundConfig => ({
  version: 1,
  enabled: true,
  gains: Array(10).fill(0),
  preamp: 0,
  presetId: "flat",
  presets: [],
  profiles: [],
  profileId: null,
  personalEnabled: false,
  strength: 100,
});
const curve = (v: number[], min: number, max: number) =>
  Array.isArray(v) &&
  v.length === 10 &&
  v.every((x) => Number.isFinite(x) && x >= min && x <= max);
export function validateSound(c: SoundConfig) {
  const name = (v: string) =>
    typeof v === "string" && v.trim().length > 0 && v.length <= 60;
  if (
    c.version !== 1 ||
    !curve(c.gains, -12, 12) ||
    !Number.isFinite(c.preamp) ||
    c.preamp < -12 ||
    c.preamp > 12 ||
    !Number.isFinite(c.strength) ||
    c.strength < 0 ||
    c.strength > 100 ||
    typeof c.enabled !== "boolean" ||
    typeof c.personalEnabled !== "boolean" ||
    !Array.isArray(c.presets) ||
    !Array.isArray(c.profiles) ||
    c.presets.length > 101 ||
    c.profiles.length > 100 ||
    typeof c.presetId !== "string"
  )
    throw new Error("Invalid sound configuration");
  const ids = new Set([
    ...BUILT_INS.map((x) => x.id),
    "bass",
    "treble",
    "voice",
  ]);
  for (const p of c.presets) {
    if (
      !name(p.id) ||
      !name(p.name) ||
      ids.has(p.id) ||
      !curve(p.gains, -12, 12) ||
      !Number.isFinite(p.preamp) ||
      p.preamp < -12 ||
      p.preamp > 12
    )
      throw new Error("Invalid sound preset");
    ids.add(p.id);
  }
  const profiles = new Set<string>();
  for (const p of c.profiles) {
    if (
      !name(p.id) ||
      !name(p.name) ||
      profiles.has(p.id) ||
      !curve(p.left, 0, 6) ||
      !curve(p.right, 0, 6) ||
      p.complete.length !== 12 ||
      p.complete.some((x) => typeof x !== "boolean")
    )
      throw new Error("Invalid personal profile");
    profiles.add(p.id);
  }
  if (c.profileId !== null && !profiles.has(c.profileId))
    throw new Error("Unknown personal profile");
  if (c.personalEnabled && !c.profileId)
    throw new Error("Choose a personal profile first");
  return normalizeSound(c);
}
export function effectiveCurves(
  c: SoundConfig,
  bypass = false,
  channels = 2,
): number[][] {
  const p =
    !bypass && c.personalEnabled && channels <= 2
      ? c.profiles.find((p) => p.id === c.profileId)
      : undefined;
  return [p?.left, p?.right].map((personal) =>
    FREQUENCIES.map(
      (_, i) =>
        (i > 0 && !bypass && c.enabled && !p ? c.gains[i] : 0) +
        ((i > 0 ? (personal?.[i] ?? 0) : 0) * c.strength) / 100,
    ),
  );
}

/** Keeps historical records while applying the simplified ordinary EQ policy. */
export function normalizeSound(c: SoundConfig): SoundConfig {
  const next = structuredClone(c);
  next.enabled = true;
  next.preamp = 0;
  next.strength = 100;
  next.gains = editableCurve(next.gains);
  const custom = next.presets.find((p) => p.id === "custom");
  if (custom) {
    custom.gains = editableCurve(custom.gains);
    custom.preamp = 0;
  }
  const preset = BUILT_INS.find((p) => p.id === next.presetId);
  if (!preset || !preset.gains.every((g, i) => g === next.gains[i]))
    return saveCustom(next, next.gains);
  return next;
}
const editableCurve = (gains: number[]) =>
  gains.map((g, i) => (i === 0 ? 0 : Math.max(-10, Math.min(10, g))));
export function saveCustom(c: SoundConfig, gains: number[]): SoundConfig {
  const curve = editableCurve(gains);
  return {
    ...c,
    enabled: true,
    preamp: 0,
    presetId: "custom",
    gains: curve,
    presets: [
      ...c.presets.filter((p) => p.id !== "custom"),
      { id: "custom", name: "Custom", gains: [...curve], preamp: 0 },
    ],
  };
}
export function selectSoundPreset(c: SoundConfig, id: string): SoundConfig {
  const selected =
    BUILT_INS.find((p) => p.id === id) ??
    c.presets.find((p) => p.id === "custom");
  return {
    ...c,
    enabled: true,
    preamp: 0,
    presetId: id,
    gains: [...(selected?.gains ?? Array(10).fill(0))],
  };
}
