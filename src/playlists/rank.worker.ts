import { personalized } from "./rank";
import type { PlaylistRequest, Track, Session } from "../types";
import type { RecommendationData } from "./types";
export interface RankingInput {
  request: PlaylistRequest;
  tracks: Track[];
  sessions: Session[];
  zone: string;
  data: RecommendationData;
  now: string;
}
self.onmessage = (event: MessageEvent<RankingInput>) => {
  try {
    const { request, tracks, sessions, zone, data, now } = event.data;
    self.postMessage({
      result: personalized(
        request,
        tracks,
        sessions,
        zone,
        data,
        new Date(now),
      ),
    });
  } catch (e) {
    self.postMessage({ error: e instanceof Error ? e.message : String(e) });
  }
};
