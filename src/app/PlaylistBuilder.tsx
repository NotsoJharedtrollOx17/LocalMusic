import { ArrowRight, Shuffle, Shield } from "lucide-react";
import { useMusicAppContext } from "./MusicAppContext";
import PlaylistFilters from "./PlaylistFilters";
import PlaylistOptions from "./PlaylistOptions";

export default function PlaylistBuilder() {
  const { total, busy, t, buildMix } = useMusicAppContext();

  return (
    <div className="generator">
      <div className="generator-title">
        <div>
          <p className="eyebrow">01 / {t.generate.toUpperCase()}</p>
          <h2>{t.makePlaylist}</h2>
          <p>{t.mixSubtitle}</p>
        </div>
        <span className="generator-mark">
          <Shuffle />
        </span>
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void buildMix();
        }}
      >
        <PlaylistFilters />
        <PlaylistOptions />
        <div className="generator-bottom">
          <span className="small-muted">
            <Shield size={16} />
            {t.filters}
          </span>
          <button
            className="button primary"
            disabled={busy || !total}
            type="submit"
          >
            {t.generate}
            <ArrowRight size={18} />
          </button>
        </div>
      </form>
    </div>
  );
}
