import { renderComparison } from "./comparison";
import type { PersonalProfile } from "./types";

// Keep sample rendering away from foreground heartbeats and UI animation.
self.onmessage = (
  event: MessageEvent<{
    profile: PersonalProfile;
    strength: number;
    mode: "original" | "personal";
  }>,
) => {
  try {
    const { profile, strength, mode } = event.data;
    const samples = renderComparison(profile, strength, mode);
    self.postMessage(samples, { transfer: [samples.buffer] });
  } catch (error) {
    self.postMessage({ error: String(error) });
  }
};
