import { useEffect } from "react";
import { ArrowLeft } from "lucide-react";
import { useBackLayer } from "../navigation";
import { useMusicAppContext } from "./MusicAppContext";

export default function InlineSearch() {
  const {
    searchOpen,
    setSearchOpen,
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
  useEffect(() => {
    if (!visible) return;
    const collapse = (event: MouseEvent) => {
      if (
        event
          .composedPath()
          .some(
            (node) =>
              node instanceof Element &&
              node.matches(
                ".inline-search,[data-search-trigger],[data-search-clear],.inline-search-status,.search-empty button,.action-menu",
              ),
          )
      )
        return;
      // The click target is fixed; collapse before a menu measures its new anchor.
      setSearchOpen(false);
    };
    document.addEventListener("click", collapse, true);
    return () => document.removeEventListener("click", collapse, true);
  }, [visible, setSearchOpen]);
  useBackLayer((visible || inlineSearch.active) && !modal && !menu, () =>
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
