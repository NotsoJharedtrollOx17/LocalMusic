import { Plus } from "lucide-react";
import { native } from "../api";
import { useMusicAppContext } from "./MusicAppContext";
import LibraryFilters from "./LibraryFilters";

export default function LibraryToolbar() {
  const {
    total,
    catalogTotal,
    libraryViewPending,
    libraryError,
    section,
    onlyFavorites,
    setOnlyFavorites,
    group,
    busy,
    fileInput,
    t,
    formatMusicCount,
    doImport,
  } = useMusicAppContext();
  const songFilters = section === "songs" && !group;
  const favorites = songFilters && onlyFavorites;
  const count = group ? group.ids.length : songFilters ? total : catalogTotal;

  return (
    <div className="library-toolbar">
      <div>
        <button
          className={"filter-button" + (!favorites ? " chosen" : "")}
          onClick={() => setOnlyFavorites(false)}
        >
          {favorites ? t.favorites : t.allMusic}
        </button>
        {count !== null &&
          !(songFilters && (libraryViewPending || libraryError)) && (
            <>
              <span className="count-dot">·</span>
              <span>{formatMusicCount(count, true)}</span>
            </>
          )}
      </div>
      <div className="toolbar-actions">
        <LibraryFilters />
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
