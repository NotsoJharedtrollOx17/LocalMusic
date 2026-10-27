import { useMusicAppContext } from "./MusicAppContext";
import type { PlaylistBlend as Blend } from "../playlists/types";
export default function PlaylistBlend() {
  const { request, chooseBlend, t } = useMusicAppContext();
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
    </fieldset>
  );
}
