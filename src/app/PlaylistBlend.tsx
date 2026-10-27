import { useMusicAppContext } from "./MusicAppContext";
import type { PlaylistBlend as Blend } from "../playlists/types";
import LoadingIndicator from "../components/LoadingIndicator";
export default function PlaylistBlend() {
  const { request, chooseBlend, playlistContext, playlistContextLoaded, t } =
    useMusicAppContext();
  return (
    <fieldset className="playlist-blend">
      <legend>{t.mixBalance}</legend>
      <div className="segmented" role="group" aria-label={t.mixBalance}>
        {(["familiar", "balanced", "explore"] as Blend[]).map((blend) => (
          <button
            key={blend}
            type="button"
            aria-pressed={(request.blend ?? "balanced") === blend}
            onClick={() => chooseBlend(blend)}
          >
            {t[blend]}
          </button>
        ))}
      </div>
      <div className="small-muted analysis-coverage">
        {playlistContextLoaded ? (
          t.analysisCoverage
            .replace("{count}", String(playlistContext.analyzed))
            .replace("{total}", String(playlistContext.total))
        ) : (
          <LoadingIndicator label={t.loading} compact />
        )}
      </div>
    </fieldset>
  );
}
