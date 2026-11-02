import { candidates, organize } from "./identity";
import type { Track } from "../types";
import type { Organization } from "./identity";
self.onmessage = (
  e: MessageEvent<{ tracks: Track[]; state: Organization }>,
) => {
  try {
    const tracks = e.data.tracks.map((t) => organize(t, e.data.state));
    self.postMessage({ tracks, ...candidates(tracks, e.data.state) });
  } catch (error) {
    self.postMessage({ error: String(error) });
  }
};
