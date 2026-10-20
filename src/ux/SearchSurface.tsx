import { useFocusScope } from "./useFocusScope";
import { useEffect, useRef, useState } from "react";
import { X, ArrowLeft, Search } from "lucide-react";
import { api } from "../api";
import { Cover, TrackRow } from "../components";
import LoadingIndicator from "../components/LoadingIndicator";
import {
  type CatalogGroup,
  type Playlist,
  type SearchResults,
  type Track,
} from "../types";
import { useBackLayer } from "../navigation";

export function SearchSurface({
  labels,
  rowLabels,
  revision,
  onClose,
  onGroup,
  onPlaylist,
  onPlay,
  onMore,
  onFavorite,
}: {
  revision: number;
  rowLabels: {
    play: string;
    favorite: string;
    details: string;
    actions: string;
    remove: string;
    moveUp: string;
    moveDown: string;
    unavailable: string;
  };
  labels: {
    search: string;
    close: string;
    songs: string;
    albums: string;
    artists: string;
    playlists: string;
    loading: string;
    empty: string;
    more: string;
    prompt: string;
    songSingular: string;
  };
  onClose: () => void;
  onGroup: (kind: "albums" | "artists", group: CatalogGroup) => void;
  onPlaylist: (p: Playlist) => void;
  onPlay: (ids: string[], index: number) => void;
  onMore: (
    track: Track,
    anchor: HTMLElement,
    point?: { x: number; y: number },
  ) => void;
  onFavorite: (track: Track) => Promise<boolean>;
}) {
  const [query, setQuery] = useState(""),
    [limit, setLimit] = useState(30),
    [result, setResult] = useState<SearchResults>(),
    [status, setStatus] = useState<"loading" | "ready" | "error">("ready"),
    [error, setError] = useState("");
  const surface = useRef<HTMLDivElement>(null);
  useFocusScope(surface, true);
  const input = useRef<HTMLInputElement>(null),
    version = useRef(0);
  useBackLayer(true, onClose);
  useEffect(() => {
    const request = ++version.current;
    if (limit === 30) setResult(undefined);
    if (!query.trim()) {
      setStatus("ready");
      return;
    }
    setStatus("loading");
    const timer = setTimeout(() => {
      void api.searchCatalog(query, limit).then(
        (value) => {
          if (request === version.current) {
            setResult(value);
            setStatus("ready");
          }
        },
        (e) => {
          if (request === version.current) {
            setError(String(e));
            setStatus("error");
          }
        },
      );
    }, 160);
    return () => {
      clearTimeout(timer);
      version.current++;
    };
  }, [query, revision, limit]);
  const groups = (kind: "albums" | "artists") =>
    result?.[kind].length ? (
      <section>
        <h3>{labels[kind]}</h3>
        {result[kind].map((g) => (
          <button
            key={JSON.stringify([g.title, g.subtitle])}
            className="search-result-group"
            onClick={() => onGroup(kind, g)}
          >
            <Cover track={g.track} />
            <span>
              <strong>{g.title}</strong>
              <small>
                {g.subtitle ||
                  `${g.ids.length} ${g.ids.length === 1 ? labels.songSingular : labels.songs}`}
              </small>
            </span>
          </button>
        ))}
      </section>
    ) : null;
  return (
    <div
      ref={surface}
      className="search-surface"
      role="search"
      aria-label={labels.search}
    >
      <div className="search-surface-head">
        <button
          className="icon-button search-dismiss"
          aria-label={labels.close}
          onClick={onClose}
        >
          <ArrowLeft className="search-back-icon" />
          <X className="search-close-icon" />
        </button>
        <Search size={20} />
        <input
          ref={input}
          type="search"
          aria-label={labels.search}
          placeholder={labels.search}
          value={query}
          onChange={(e) => {
            setLimit(30);
            setQuery(e.target.value);
          }}
        />
      </div>
      <div className="search-results" aria-busy={status === "loading"}>
        {!query.trim() && <p className="search-prompt">{labels.prompt}</p>}
        {status === "loading" && <LoadingIndicator label={labels.loading} />}
        {status === "error" && (
          <div role="alert">
            <p>{error}</p>
            <button
              className="text-button"
              onClick={() => setQuery(query + " ")}
            >
              {labels.search}
            </button>
          </div>
        )}
        {result && (
          <>
            {result.tracks.length > 0 && (
              <section>
                <h3>{labels.songs}</h3>
                {result.tracks.map((track, index) => (
                  <TrackRow
                    key={track.id}
                    track={track}
                    unknownArtist=""
                    labels={rowLabels}
                    onPlay={() =>
                      onPlay(
                        result.tracks.map((t) => t.id),
                        index,
                      )
                    }
                    onFavorite={() =>
                      void onFavorite(track).then((saved) => {
                        if (saved)
                          setResult(
                            (old) =>
                              old && {
                                ...old,
                                tracks: old.tracks.map((t) =>
                                  t.id === track.id
                                    ? { ...t, favorite: !track.favorite }
                                    : t,
                                ),
                              },
                          );
                      })
                    }
                    onMore={(e) =>
                      onMore(
                        track,
                        e.currentTarget,
                        e.type === "contextmenu" && (e.clientX || e.clientY)
                          ? { x: e.clientX, y: e.clientY }
                          : undefined,
                      )
                    }
                  />
                ))}
              </section>
            )}
            {groups("albums")}
            {groups("artists")}
            {result.playlists.length > 0 && (
              <section>
                <h3>{labels.playlists}</h3>
                {result.playlists.map((p) => (
                  <button
                    className="search-result-group"
                    key={p.id}
                    onClick={() => onPlaylist(p)}
                  >
                    {p.title}
                  </button>
                ))}
              </section>
            )}
            {![
              result.tracks,
              result.albums,
              result.artists,
              result.playlists,
            ].some((items) => items.length) && <p>{labels.empty}</p>}
          </>
        )}
      </div>
      {result?.hasMore && (
        <button
          className="button secondary"
          disabled={status === "loading"}
          onClick={() => setLimit((n) => n + 30)}
        >
          {labels.more}
        </button>
      )}
    </div>
  );
}
