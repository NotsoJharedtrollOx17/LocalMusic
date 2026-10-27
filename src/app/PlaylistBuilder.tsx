import { ArrowRight, Hammer, Wrench, Shield } from "lucide-react";
import { useMusicAppContext } from "./MusicAppContext";
import PlaylistFilters from "./PlaylistFilters";
import PlaylistOptions from "./PlaylistOptions";
import PlaylistBlend from "./PlaylistBlend";
import PlaylistAnalysis from "./PlaylistAnalysis";
import LoadingIndicator from "../components/LoadingIndicator";

export default function PlaylistBuilder() {
  const { catalogTotal, busy, buildingMix, generationPhase, t, buildMix } =
    useMusicAppContext();

  return (
    <div className="generator">
      <div className="generator-title">
        <div>
          <p className="eyebrow">01 / {t.generate.toUpperCase()}</p>
          <h2>{t.makePlaylist}</h2>
          <p>{t.mixSubtitle}</p>
        </div>
        <span className="generator-mark creation-mark" aria-hidden="true">
          <Hammer />
          <Wrench />
        </span>
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void buildMix();
        }}
      >
        <PlaylistFilters />
        <PlaylistBlend />
        <PlaylistOptions />
        <PlaylistAnalysis />
        <div
          className="playlist-generation-status"
          role="status"
          aria-live="polite"
        >
          {buildingMix && (
            <>
              <span aria-hidden="true">
                <LoadingIndicator label={t.generatingPlaylist} compact />
              </span>
              <span>
                {generationPhase === "sound"
                  ? t.checkingSound
                  : t.matchingPlaylist}
              </span>
            </>
          )}
        </div>
        <div className="generator-bottom">
          <span className="small-muted">
            <Shield size={16} />
            {t.filters}
          </span>
          <button
            className="button primary"
            disabled={busy || !catalogTotal}
            type="submit"
            aria-busy={buildingMix}
          >
            {buildingMix ? t.generatingPlaylist : t.generate}
            {!buildingMix && <ArrowRight size={18} />}
          </button>
        </div>
      </form>
    </div>
  );
}
