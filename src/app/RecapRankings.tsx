import { Cover } from "../components";
import { key } from "../domain";
import type { Track } from "../types";
import { useMusicAppContext } from "./MusicAppContext";

export default function RecapRankings({
  category,
}: {
  category?: "songs" | "artists" | "albums";
}) {
  const { recap, cache, t } = useMusicAppContext();
  if (!recap) return null;
  const groups = [
    {
      key: "songs",
      title: t.topSongs,
      items: recap.topTracks.slice(0, 3).map((x) => ({
        name: x.track.title,
        detail: x.track.artist,
        plays: x.plays,
        artwork: cache[x.track.id] ?? x.track,
      })),
    },
    {
      key: "artists",
      title: t.topArtists,
      items: (recap.topArtists?.length
        ? recap.topArtists
        : recap.topArtist
          ? [recap.topArtist]
          : []
      ).map((x) => ({
        ...x,
        detail: "",
        artwork: undefined as Track | undefined,
      })),
    },
    {
      key: "albums",
      title: t.topAlbums,
      items: (recap.topAlbums?.length
        ? recap.topAlbums
        : recap.topAlbum
          ? [recap.topAlbum]
          : []
      ).map((x) => ({
        ...x,
        detail: x.artist,
        artwork: (x.trackId ? cache[x.trackId] : undefined) ??
          recap.topTracks.find((t) =>
            x.trackId
              ? t.track.id === x.trackId
              : key(t.track.album) === key(x.name) &&
                key(t.track.artist) === key(x.artist),
          )?.track ?? {
            id: `recap-album:${x.artist}:${x.name}`,
            title: x.name,
            artist: x.artist,
            album: x.name,
            genre: "",
            sourceUri: "",
            durationMs: 0,
            available: false,
            favorite: false,
          },
      })),
    },
  ].filter((g) => !category || g.key === category);
  return (
    <div className="recap-rankings">
      {groups.map((g) => (
        <section key={g.key} aria-label={g.title}>
          <h2>{g.title}</h2>
          {g.items.length ? (
            <ol>
              {g.items.map((x, i) => (
                <li
                  key={i}
                  className={`recap-rank rank-${i + 1}${x.artwork ? " has-artwork" : ""}`}
                >
                  <span className="recap-rank-number" aria-hidden="true">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  {x.artwork && (
                    <Cover
                      track={x.artwork}
                      className="recap-rank-artwork"
                      large={Boolean(x.artwork.sourceUri)}
                    />
                  )}
                  <div>
                    <h3>{x.name}</h3>
                    {x.detail && <p>{x.detail}</p>}
                    <small>
                      {x.plays.toLocaleString()} {t.plays}
                    </small>
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <p className="small-muted">{t.noPlays}</p>
          )}
        </section>
      ))}
    </div>
  );
}
