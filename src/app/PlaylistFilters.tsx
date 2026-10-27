import { useMusicAppContext } from "./MusicAppContext";

export default function PlaylistFilters() {
  const {
    playlistContext,
    request,
    setRequest,
    targetMode,
    setTargetMode,
    target,
    setTarget,
    t,
  } = useMusicAppContext();

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
        {t.target}
        <div className="joined-input">
          <select
            aria-label={t.target}
            value={targetMode}
            onChange={(e) => {
              const mode = e.target.value as typeof targetMode;
              setTargetMode(mode);
              setTarget(mode === "count" ? 25 : 45);
            }}
          >
            <option value="count">{t.trackCount}</option>
            <option value="duration">{t.minutes}</option>
          </select>
          <input
            aria-label={targetMode === "count" ? t.count : t.minutes}
            type="number"
            min="1"
            max={targetMode === "count" ? 100 : 600}
            value={target}
            onChange={(e) => setTarget(Number(e.target.value))}
            required
          />
        </div>
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
