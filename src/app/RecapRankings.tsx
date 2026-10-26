import { useMusicAppContext } from "./MusicAppContext";

export default function RecapRankings({
  category,
}: {
  category?: "songs" | "artists" | "albums";
}) {
  const { recap, t } = useMusicAppContext();
  if (!recap) return null;
  const groups = [
    {
      key: "songs",
      title: t.topSongs,
      items: recap.topTracks.slice(0, 3).map((x) => ({
        name: x.track.title,
        detail: x.track.artist,
        plays: x.plays,
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
      ).map((x) => ({ ...x, detail: "" })),
    },
    {
      key: "albums",
      title: t.topAlbums,
      items: (recap.topAlbums?.length
        ? recap.topAlbums
        : recap.topAlbum
          ? [recap.topAlbum]
          : []
      ).map((x) => ({ ...x, detail: x.artist })),
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
                <li key={i} className={`recap-rank rank-${i + 1}`}>
                  <span className="recap-rank-number" aria-hidden="true">
                    {String(i + 1).padStart(2, "0")}
                  </span>
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
