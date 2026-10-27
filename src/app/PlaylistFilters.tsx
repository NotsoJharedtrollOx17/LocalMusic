import { useMusicAppContext } from "./MusicAppContext";
import ArtistFilter from "./ArtistFilter";
import { key } from "../domain";

export default function PlaylistFilters() {
  const { playlistContext, request, setRequest, target, setTarget, t } =
    useMusicAppContext();

  return (
    <div className="generator-fields">
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
        {t.trackCount}
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
      <label>
        {t.genre}
        <input
          list="genres"
          value={request.genre}
          placeholder={t.anyGenre}
          onChange={(e) =>
            setRequest({
              ...request,
              genre: e.target.value,
            })
          }
        />
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
