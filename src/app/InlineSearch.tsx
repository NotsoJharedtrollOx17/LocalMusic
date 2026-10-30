import { X, ArrowLeft } from "lucide-react";
import { useBackLayer } from "../navigation";
import { useMusicAppContext } from "./MusicAppContext";

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
  } = useMusicAppContext();
  const visible = searchOpen && section !== "year";
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
    </form>
  );
}
