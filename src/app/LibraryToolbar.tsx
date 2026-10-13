import { Plus } from "lucide-react";
import { native } from "../api";
import { useMusicAppContext } from "./MusicAppContext";
import LibraryFilters from "./LibraryFilters";

export default function LibraryToolbar() {
  const {
    total,
    onlyFavorites,
    setOnlyFavorites,
    group,
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
