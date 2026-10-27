import { Cover } from "../components";
import { recapRankings } from "../recap/rankings";
import { useMusicAppContext } from "./MusicAppContext";

export default function RecapRankings({
  category,
}: {
  category?: "songs" | "artists" | "albums";
}) {
  const { recap, cache, t } = useMusicAppContext();
  if (!recap) return null;
  const groups = recapRankings(recap, cache).filter(
    (g) => !category || g.key === category,
  );
  return (
    <div className="recap-rankings">
      {groups.map((g) => (
        <section key={g.key} aria-label={t[g.titleKey]}>
          <h2>{t[g.titleKey]}</h2>
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
