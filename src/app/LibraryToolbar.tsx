import { LoaderCircle, Plus, SlidersHorizontal, Heart } from "lucide-react";
import { native } from "../api";
import { IconButton } from "../components";
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
    doImport,
  } = useMusicAppContext();

  return (
    <div className="library-toolbar">
      <div>
        <button
          className={"filter-button" + (!onlyFavorites ? " chosen" : "")}
          onClick={() => setOnlyFavorites(false)}
        >
          {t.allMusic}
        </button>
        <span className="count-dot">·</span>
        <span>
          {(group ? group.ids.length : total).toLocaleString(
            settings?.language,
          )}{" "}
          {t.songCount}
        </span>
      </div>
      <div className="toolbar-actions">
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
            <IconButton
              label={t.favorites}
              active={onlyFavorites}
              onClick={() => setOnlyFavorites(!onlyFavorites)}
            >
              <Heart size={18} />
            </IconButton>
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
        <IconButton
          label={t.import}
          disabled={busy}
          onClick={() =>
            native ? void doImport() : fileInput.current?.click()
          }
        >
          <Plus size={20} />
        </IconButton>
      </div>
    </div>
  );
}
