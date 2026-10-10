import { bank, headroom, SoundProcessor } from "./dsp";
import { effectiveCurves, defaultSound } from "./model";
import { comparisonSample } from "./personal";
import type { PersonalProfile } from "./types";
/** Both alternatives share the quieter RMS, avoiding a louder-is-better preview. */
export function renderComparison(
  profile: PersonalProfile,
  strength: number,
  mode: "original" | "personal",
  rate = 48000,
) {
  const original = comparisonSample(rate),
    config = {
      ...defaultSound(),
      personalEnabled: true,
      profileId: profile.id,
      profiles: [profile],
      strength,
    };
  const cs = bank(effectiveCurves(config), rate),
    attenuation = headroom(cs, rate),
    dsp = new SoundProcessor(rate);
  dsp.configure(cs, 10 ** (-attenuation / 20), false);
  const personal = new Float32Array(original.length);
  let a = 0,
    b = 0;
  for (let i = 0; i < original.length; i += 2) {
    const frame = dsp.process([original[i], original[i + 1]]);
    personal[i] = frame[0];
    personal[i + 1] = frame[1];
    a += original[i] ** 2 + original[i + 1] ** 2;
    b += frame[0] ** 2 + frame[1] ** 2;
  }
  const target = Math.min(a, b),
    source = mode === "original" ? original : personal,
    energy = mode === "original" ? a : b,
    gain = Math.sqrt(target / Math.max(energy, 1e-20));
  return source.map((x) => x * gain);
}
