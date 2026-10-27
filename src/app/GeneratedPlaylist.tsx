import { Plus, Play } from "lucide-react";
import { api } from "../api";
import { useMusicAppContext } from "./MusicAppContext";
import TrackRows from "./TrackRows";

export default function GeneratedPlaylist() {
  const { generated, t, act, saveList, playlistTracks, formatMusicCount } =
    useMusicAppContext();

  if (!generated) return null;
  return (
    <div className="generated-result">
      <div className="result-heading">
        <div>
          <h2>{generated.title}</h2>
          <span>
            {formatMusicCount(playlistTracks.length)} ·{" "}
            {Math.round(
              playlistTracks.reduce((s, x) => s + x.durationMs, 0) / 60000,
            )}{" "}
            {t.minutes.toLowerCase()}
          </span>
        </div>
        <button
          className="text-button"
          onClick={() => void saveList(generated)}
        >
          <Plus size={17} />
          {t.save}
        </button>
      </div>
      {generated.recommendation && (
        <p className="small-muted">
          {generated.recommendation.source === "discovery"
            ? t.libraryDiscovery
            : generated.recommendation.source === "favorites"
              ? t.favoriteMix
              : t.historyMix}
          {generated.recommendation.shortage ? ` · ${t.mixShortage}` : ""}
        </p>
      )}
      {<TrackRows ts={playlistTracks} queueIds={generated.trackIds} />}
      <button
        className="button primary full-width"
        onClick={() => void act(() => api.play(generated.trackIds))}
      >
        <Play size={18} />
        {t.playMix}
      </button>
    </div>
  );
}
