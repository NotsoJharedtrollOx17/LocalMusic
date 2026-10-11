import { Clock3, History, TrendingUp, Heart, ArrowUpRight } from "lucide-react";
import { useMusicAppContext } from "./MusicAppContext";
import { automaticPlaylistLabel } from "./automaticPlaylistLabels";
export default function AutomaticPlaylistCollection() {
  const { automatic, t, openPlaylist, formatMusicCount } = useMusicAppContext();
  const definitions = [
    {
      key: "recently-added",
      title: t.recentlyAdded,
      description: t.recentlyAddedHint,
      Icon: Clock3,
    },
    {
      key: "recently-played",
      title: t.recentlyPlayed,
      description: t.recentlyPlayedHint,
      Icon: History,
    },
    {
      key: "most-played",
      title: t.mostPlayed,
      description: t.mostPlayedHint,
      Icon: TrendingUp,
    },
    {
      key: "favorites",
      title: t.favorites,
      description: t.favoritesHint,
      Icon: Heart,
    },
  ];
  return (
    <section className="automatic-playlists" aria-label={t.automaticPlaylists}>
      <h3>{t.automaticPlaylists}</h3>
      <div className="playlist-collection" aria-busy={automatic.loading}>
        {definitions.map(({ key, title, description, Icon }) => {
          const p = automatic.playlists.find(
            (p) => p.id === `automatic:${key}`,
          );
          return (
            <button
              key={key}
              className="playlist-tile automatic-playlist-tile"
              disabled={!p}
              onClick={() => p && void openPlaylist(p)}
            >
              <div className="playlist-tile-art">
                <Icon size={32} />
                <span>
                  {p ? String(p.trackIds.length).padStart(2, "0") : "—"}
                </span>
              </div>
              <div>
                <h4>{p ? automaticPlaylistLabel(p, t) : title}</h4>
                <span>
                  {p
                    ? formatMusicCount(p.trackIds.length)
                    : automatic.error
                      ? t.unavailable
                      : t.loading}
                </span>
                <p>{description}</p>
              </div>
              <ArrowUpRight size={20} />
            </button>
          );
        })}
      </div>
      {automatic.error && (
        <div className="automatic-playlist-error" role="alert">
          <p>{t.automaticPlaylistsError}</p>
          <button
            className="text-button"
            onClick={() => void automatic.refresh()}
          >
            {t.retry}
          </button>
        </div>
      )}
    </section>
  );
}
