import { consumeCompatibilityClick } from "../ux/compatibilityClick";
import TrackList from "../TrackList";
import { usePhoneLayout } from "../ux/usePhoneLayout";
import { useEffect, useState, useRef } from "react";
import { Cover } from "../components";
import LoadingIndicator from "../components/LoadingIndicator";
import { useMusicAppContext } from "./MusicAppContext";

export default function CatalogGroupGrid({
  groups,
  kind: requestedKind,
  loading = false,
}: {
  groups?: import("../types").CatalogGroup[];
  kind?: "albums" | "artists";
  loading?: boolean;
} = {}) {
  const {
    section,
    catalogGroups: currentGroups,
    group,
    catalogRevision,
    query,
    selectedGroupPage: currentPage,
    t,
    formatMusicCount,
    openGroup,
    refreshGroups,
    act,
  } = useMusicAppContext();
  const kind = requestedKind ?? (section === "artists" ? "artists" : "albums");
  const catalogGroups = groups ?? currentGroups;
  const page = groups
    ? {
        groups,
        total: groups.length,
        status: loading ? "loading" : "ready",
        loaded: true,
      }
    : currentPage;
  const collectionAlbums = group?.kind === "artists" && kind === "albums";
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
  const container = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(innerWidth);
  useEffect(() => {
    const node = container.current;
    if (!node) return;
    const observer = new ResizeObserver(() => setWidth(node.clientWidth));
    observer.observe(node);
    setWidth(node.clientWidth);
    return () => observer.disconnect();
  }, []);
  const virtual = catalogGroups.length > 80;
  const columns = phone
    ? kind === "albums"
      ? 2
      : 1
    : Math.max(1, Math.floor((width + 26) / 176));
  const measurementKey = JSON.stringify([
    kind,
    Math.round(width / 8),
    columns,
    catalogRevision,
    query,
  ]);
  const empty = kind === "albums" ? t.emptyAlbums : t.emptyArtists;
  const renderCard = (g: (typeof catalogGroups)[number]) => (
    <button
      key={g.id ?? JSON.stringify([g.title, g.subtitle])}
      className="album-card"
      data-group-key={g.id ?? JSON.stringify([kind, g.title, g.subtitle])}
      onPointerDown={(e) => {
        delete e.currentTarget.dataset.touchOpened;
        if (phone) {
          e.currentTarget.dataset.pressValid = "true";
          e.currentTarget.dataset.pressX = String(e.clientX);
          e.currentTarget.dataset.pressY = String(e.clientY);
        }
      }}
      onPointerMove={(e) => {
        const card = e.currentTarget;
        if (
          Math.hypot(
            e.clientX - Number(card.dataset.pressX),
            e.clientY - Number(card.dataset.pressY),
          ) > 10
        )
          delete card.dataset.pressValid;
      }}
      onPointerCancel={(e) => {
        delete e.currentTarget.dataset.pressValid;
      }}
      onPointerLeave={(e) => {
        delete e.currentTarget.dataset.pressValid;
      }}
      onPointerUp={(e) => {
        const card = e.currentTarget;
        if (
          phone &&
          e.pointerType === "touch" &&
          card.dataset.pressValid &&
          Math.hypot(
            e.clientX - Number(card.dataset.pressX),
            e.clientY - Number(card.dataset.pressY),
          ) < 10
        ) {
          card.dataset.touchOpened = "true";
          consumeCompatibilityClick();
          openGroup(kind, g, card);
        }
        delete card.dataset.pressValid;
      }}
      onClick={(e) => {
        if (e.detail > 0 && e.currentTarget.dataset.touchOpened) return;
        openGroup(kind, g, e.currentTarget);
      }}
    >
      <Cover track={g.track} large size={256} />
      <div className="group-card-copy">
        <strong>{g.title}</strong>
        <span>
          {collectionAlbums ? "" : g.subtitle || formatMusicCount(g.ids.length)}
          {kind === "albums" && g.track.releaseYear
            ? " · " + g.track.releaseYear
            : ""}
        </span>
      </div>
    </button>
  );
  return (
    <div
      ref={container}
      style={{ "--catalog-columns": columns } as React.CSSProperties}
      className={
        "album-grid catalog-" + kind + (virtual ? " catalog-virtual" : "")
      }
      data-catalog-total={catalogGroups.length}
      aria-busy={pending}
    >
      {virtual ? (
        <TrackList
          itemKey={(i) => catalogGroups[i * columns]?.id ?? i}
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
