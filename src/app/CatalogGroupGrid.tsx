import { useEffect, useState } from "react";
import { Cover } from "../components";
import LoadingIndicator from "../components/LoadingIndicator";
import { useMusicAppContext } from "./MusicAppContext";

export default function CatalogGroupGrid() {
  const {
    section,
    catalogGroups,
    selectedGroupPage: page,
    t,
    formatMusicCount,
    openGroup,
    refreshGroups,
    act,
  } = useMusicAppContext();
  const kind = section === "artists" ? "artists" : "albums";
  const pending = page.status === "idle" || page.status === "loading";
  const initialRead = pending && !page.loaded;
  const [loadingKind, setLoadingKind] = useState<string | null>(null);
  useEffect(() => {
    setLoadingKind(null);
    if (!initialRead) return;
    const timer = setTimeout(() => setLoadingKind(kind), 180);
    return () => clearTimeout(timer);
  }, [kind, initialRead]);
  const empty = kind === "albums" ? t.emptyAlbums : t.emptyArtists;
  return (
    <div className={"album-grid catalog-" + kind} aria-busy={pending}>
      {catalogGroups.map((g) => (
        <button
          key={g.id ?? JSON.stringify([g.title, g.subtitle])}
          className="album-card"
          data-group-key={g.id ?? JSON.stringify([kind, g.title, g.subtitle])}
          onClick={(e) => openGroup(kind, g, e.currentTarget)}
        >
          <Cover track={g.track} large />
          <div className="group-card-copy">
            <strong>{g.title}</strong>
            <span>
              {g.subtitle || formatMusicCount(g.ids.length)}
              {kind === "albums" && g.track.releaseYear
                ? " · " + g.track.releaseYear
                : ""}
            </span>
          </div>
        </button>
      ))}
      {!catalogGroups.length &&
        page.status !== "error" &&
        (initialRead ? (
          <div className="catalog-group-state">
            {loadingKind === kind && (
              <div
                className="catalog-loading-label"
                aria-label={
                  kind === "albums" ? t.loadingAlbums : t.loadingArtists
                }
              >
                <LoadingIndicator
                  label={kind === "albums" ? t.loadingAlbums : t.loadingArtists}
                />
              </div>
            )}
          </div>
        ) : (
          <p className="empty-small">{empty}</p>
        ))}
      {page.status === "error" && (
        <button
          className="button secondary"
          onClick={() => void act(() => refreshGroups(kind))}
        >
          {t.retry}
        </button>
      )}
    </div>
  );
}
