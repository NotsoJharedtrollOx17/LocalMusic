import type { Playlist } from "../types";
export type PlaylistBlend = "familiar" | "balanced" | "explore";
export interface AcousticFeature {
  version: number;
  fingerprint: string;
  bands: number[];
  seconds: number;
}
export interface RecommendationData {
  less: string[];
  features: Record<string, AcousticFeature>;
}
export interface PlaylistContext {
  artists: string[];
  genres: string[];
  less: string[];
  analyzed: number;
  total: number;
  scanning: boolean;
}
export interface MixRecommendation {
  source: "history" | "favorites" | "discovery";
  analyzed: number;
  total: number;
  shortage: boolean;
  reasons: Record<string, string[]>;
}
export interface GeneratedMix extends Playlist {
  recommendation?: MixRecommendation;
}
