import { useMusicAppContext } from "./MusicAppContext";
import ArtistFilter from "./ArtistFilter";
import { key } from "../domain";

export default function PlaylistFilters({ part = "basics" }: { part?: "basics" | "filters" }) {
  const { playlistContext, request, setRequest, target, setTarget, t } =
    useMusicAppContext();

  if (part === "basics") return (
    <div className="generator-fields generator-basics">
      <label>
        {t.playlistName}
        <input
          value={request.title}
          placeholder={t.makePlaylist}
          onChange={(e) =>
            setRequest({
              ...request,
              title: e.target.value,
            })
          }
        />
      </label>
      <label>
        {t.songs}
        <input
          aria-label={t.count}
          type="number"
          min="1"
          max="100"
          value={target}
          onChange={(e) => setTarget(Number(e.target.value))}
          required
        />
      </label>
    </div>
  );
  return (
    <div className="generator-fields generator-refinements">
      <label>
        {t.genre}
        <input
          list="genres"
          aria-label={t.genre}
          value={request.genre}
          placeholder={t.anyGenre}
          onChange={(e) =>
            setRequest({
              ...request,
              genre: e.target.value,
            })
          }
        />
        {request.genre.trim() && [request.includeArtist, ...(request.includeArtists ?? [])].some((name) => key(name)) && (
          <small>{t.genreArtistPreference}</small>
        )}
        <datalist id="genres">
          {playlistContext.genres.map((g) => (
            <option key={g} value={g} />
          ))}
        </datalist>
      </label>
      <ArtistFilter mode="include" />
      <ArtistFilter mode="exclude" />
      <datalist id="artists">
        {playlistContext.artists.map((artist) => (
          <option key={artist} value={artist} />
        ))}
      </datalist>
      {(() => {
        const included = [
          request.includeArtist,
          ...(request.includeArtists ?? []),
        ].filter((name) => key(name));
        const excluded = new Set(
          [request.excludeArtist, ...(request.excludeArtists ?? [])]
            .map(key)
            .filter(Boolean),
        );
        const conflicts = [
          ...new Map(
            included
              .filter((name) => excluded.has(key(name)))
              .map((name) => [key(name), name.trim()]),
          ).values(),
        ];
        return conflicts.length ? (
          <p className="artist-conflict" role="status">
            {t.artistConflict.replace("{artists}", conflicts.join(", "))}
          </p>
        ) : null;
      })()}
    </div>
  );
}
