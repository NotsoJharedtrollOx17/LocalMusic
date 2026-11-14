import TrackList from "../TrackList";
import { usePhoneLayout } from "../ux/usePhoneLayout";
import { useEffect, useState } from "react";
import { Cover } from "../components";
import LoadingIndicator from "../components/LoadingIndicator";
import { useMusicAppContext } from "./MusicAppContext";

export default function CatalogGroupGrid() {
  const {
    section,
    catalogGroups,
    catalogRevision,
    query,
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
  const phone = usePhoneLayout();
  const [width, setWidth] = useState(innerWidth);
  useEffect(() => {
    const resize = () => setWidth(innerWidth);
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);
  const virtual = phone && catalogGroups.length > 80;
  const columns = kind === "albums" ? 2 : 1;
  const measurementKey = JSON.stringify([kind, width, catalogRevision, query]);
  const empty = kind === "albums" ? t.emptyAlbums : t.emptyArtists;
  const renderCard = (g: (typeof catalogGroups)[number]) => (
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
  );
  return (
    <div
      className={
        "album-grid catalog-" + kind + (virtual ? " catalog-virtual" : "")
      }
      data-catalog-total={catalogGroups.length}
      aria-busy={pending}
    >
      {virtual ? (
        <TrackList
          key={measurementKey}
          count={Math.ceil(catalogGroups.length / columns)}
          estimateSize={kind === "artists" ? 84 : 260}
          measurementKey={measurementKey}
          render={(row) => (
            <div className={"catalog-virtual-row " + kind}>
              {catalogGroups
                .slice(row * columns, (row + 1) * columns)
                .map(renderCard)}
            </div>
          )}
        />
      ) : (
        catalogGroups.map(renderCard)
      )}
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
