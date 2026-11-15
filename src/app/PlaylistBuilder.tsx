import { usePhoneLayout } from "../ux/usePhoneLayout";
import { ArrowRight, Hammer, Shuffle } from "lucide-react";
import { useMusicAppContext } from "./MusicAppContext";
import PlaylistFilters from "./PlaylistFilters";
import PlaylistOptions from "./PlaylistOptions";
import PlaylistBlend from "./PlaylistBlend";
import PlaylistAnalysis from "./PlaylistAnalysis";
import LoadingIndicator from "../components/LoadingIndicator";

export default function PlaylistBuilder() {
  const phone = usePhoneLayout();
  const { catalogTotal, busy, buildingMix, generationPhase, t, buildMix, request } =
    useMusicAppContext();

  return (
    <div className="generator">
      <div className="generator-title">
        <div>
          <h2>{t.makePlaylist}</h2>
          <p>{t.mixSubtitle}</p>
        </div>
        <span className="generator-mark creation-mark" aria-hidden="true">
          <svg viewBox="0 0 64 64" fill="none" aria-hidden="true">
            <g transform="rotate(25 32 23)">
              <Hammer x={17} y={8} size={30} strokeWidth={2} />
            </g>
            <g transform="rotate(-15 42 47)">
              <Shuffle x={33} y={38} size={18} strokeWidth={2} />
            </g>
          </svg>
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
        <details className="playlist-refine" open={!phone}>
          <summary>{t.refinePlaylist}
            <span className="refine-summary">{[request.genre, request.includeArtist, ...(request.includeArtists ?? []), request.excludeArtist, ...(request.excludeArtists ?? [])].filter(x => x.trim()).join(" ? ")}</span>
          </summary>
          <PlaylistFilters part="filters" />
          <PlaylistOptions />
        </details>
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
