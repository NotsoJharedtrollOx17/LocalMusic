import { useEffect, useState } from "react";
import { Search, X, ArrowLeft } from "lucide-react";
import { useBackLayer } from "../navigation";
import { useMusicAppContext } from "./MusicAppContext";
import LoadingIndicator from "../components/LoadingIndicator";

export default function InlineSearch() {
  const {
    searchOpen,
    section,
    group,
    selectedList,
    query,
    setQuery,
    searchInput,
    inlineSearch,
    modal,
    menu,
    t,
    settings,
  } = useMusicAppContext();
  const visible = searchOpen && section !== "year";
  const [showLoading, setShowLoading] = useState(false);
  useEffect(() => {
    setShowLoading(false);
    if (!inlineSearch.pending) return;
    const timer = setTimeout(() => setShowLoading(true), 250);
    return () => clearTimeout(timer);
  }, [inlineSearch.pending]);
  useBackLayer(visible && !modal && !menu, () =>
    query ? inlineSearch.clear() : inlineSearch.close(),
  );
  if (!visible) return null;
  const label =
    group || (section === "playlists" && selectedList)
      ? t.searchCollection
      : section === "songs"
        ? t.searchSongs
        : section === "albums"
          ? t.searchAlbums
          : section === "artists"
            ? t.searchArtists
            : t.searchPlaylists;
  const page = inlineSearch.page;
  return (
    <form
      className="inline-search"
      role="search"
      aria-label={label}
      data-no-swipe
      onSubmit={(event) => {
        event.preventDefault();
        inlineSearch.applyNow();
      }}
    >
      <div className="inline-search-field">
        <Search size={20} aria-hidden="true" />
        <input
          ref={searchInput}
          type="search"
          aria-label={label}
          placeholder={label}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          autoComplete="off"
          aria-controls="library-content"
        />
        {query && (
          <button
            className="icon-button"
            type="button"
            aria-label={t.clearSearch}
            onClick={() => {
              inlineSearch.clear();
              searchInput.current?.focus();
            }}
          >
            <X size={19} />
          </button>
        )}
        <button
          className="icon-button"
          type="button"
          aria-label={t.closeSearch}
          onClick={inlineSearch.close}
        >
          <ArrowLeft size={19} />
        </button>
      </div>
      <div
        className="inline-search-status"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {inlineSearch.error ? (
          <>
            <span>{t.searchFailed}</span>
            <button
              type="button"
              className="text-button"
              onClick={inlineSearch.retry}
            >
              {t.retry}
            </button>
          </>
        ) : inlineSearch.pending ? (
          showLoading && <LoadingIndicator label={t.searching} compact />
        ) : inlineSearch.active && page ? (
          <span>
            {t.searchCount
              .replace("{count}", page.total.toLocaleString(settings?.language))
              .replace(
                "{total}",
                page.allTotal.toLocaleString(settings?.language),
              )}
          </span>
        ) : (
          <span>{label}</span>
        )}
      </div>
    </form>
  );
}
