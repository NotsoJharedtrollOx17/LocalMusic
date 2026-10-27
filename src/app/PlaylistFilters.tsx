import { useMusicAppContext } from "./MusicAppContext";

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
      <label>
        {t.includeArtist}
        <input
          list="artists"
          value={request.includeArtist}
          placeholder={t.anyArtist}
          onChange={(e) =>
            setRequest({
              ...request,
              includeArtist: e.target.value,
            })
          }
        />
      </label>
      <label>
        {t.excludeArtist}
        <input
          list="artists"
          value={request.excludeArtist}
          placeholder="—"
          onChange={(e) =>
            setRequest({
              ...request,
              excludeArtist: e.target.value,
            })
          }
        />
        <datalist id="artists">
          {playlistContext.artists.map((g) => (
            <option key={g} value={g} />
          ))}
        </datalist>
      </label>
    </div>
  );
}
