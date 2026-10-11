import { LoaderCircle, Plus } from "lucide-react";
import LibraryActions from "./LibraryActions";
import { native } from "../api";
import { useMusicAppContext } from "./MusicAppContext";

export default function LibraryToolbar() {
  const {
    section,
    total,
    onlyFavorites,
    setOnlyFavorites,
    group,
    groupLoading,
    selectedGroupPage,
    catalogGroups,
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
