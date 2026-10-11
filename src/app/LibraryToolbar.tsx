import { LoaderCircle, Plus, SlidersHorizontal } from "lucide-react";
import LibraryActions from "./LibraryActions";
import { native } from "../api";
import { useMusicAppContext } from "./MusicAppContext";

export default function LibraryToolbar() {
  const {
    section,
    total,
    onlyFavorites,
    setOnlyFavorites,
    sort,
    setSort,
    group,
    groupLoading,
    selectedGroupPage,
    catalogGroups,
    settings,
    busy,
    fileInput,
    t,
    formatMusicCount,
    doImport,
  } = useMusicAppContext();

  return (
    <div className="library-toolbar">
      <div>
        <button
          className={"filter-button" + (!onlyFavorites ? " chosen" : "")}
          onClick={() => setOnlyFavorites(false)}
        >
          {onlyFavorites ? t.favorites : t.allMusic}
        </button>
        <span className="count-dot">·</span>
        <span>{formatMusicCount(group ? group.ids.length : total, true)}</span>
      </div>
      <div className="toolbar-actions">
        <LibraryActions />
        {!group &&
          (groupLoading ||
            (section !== "songs" &&
              selectedGroupPage.status === "loading" &&
              catalogGroups.length > 0)) && (
            <span className="group-loading" role="status">
              <LoaderCircle size={18} className="spinner" aria-hidden="true" />
              {t.loading}
            </span>
          )}
        {section === "songs" && !group && (
          <>
            <label className="sort-select">
              <SlidersHorizontal size={18} />
              <select
                aria-label={t.sort}
                value={sort}
                onChange={(e) => setSort(e.target.value as typeof sort)}
              >
                <option value="title">{t.sort}</option>
                <option value="artist">{t.sortArtist}</option>
                <option value="album">{t.sortAlbum}</option>
              </select>
            </label>
          </>
        )}
        <button
          className="button primary library-import"
          disabled={busy}
          onClick={() =>
            native ? void doImport() : fileInput.current?.click()
          }
        >
          <Plus size={18} />
          {t.import}
        </button>
      </div>
    </div>
  );
}
