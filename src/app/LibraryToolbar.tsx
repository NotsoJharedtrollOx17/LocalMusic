import { Plus } from "lucide-react";
import { native } from "../api";
import { useMusicAppContext } from "./MusicAppContext";
import LibraryFilters from "./LibraryFilters";
import CollectionCountHeading from "./CollectionCountHeading";

export default function LibraryToolbar() {
  const {
    total,
    libraryViewPending,
    libraryError,
    section,
    onlyFavorites,
    groupsTotal,
    selectedGroupPage,
    group,
    busy,
    fileInput,
    t,
    doImport,
  } = useMusicAppContext();
  const songFilters = section === "songs" && !group;
  const favorites = songFilters && onlyFavorites;
  const kind =
    !group && (section === "albums" || section === "artists")
      ? section
      : "songs";
  const count = group
    ? group.ids.length
    : songFilters
      ? libraryViewPending || libraryError
        ? null
        : total
      : selectedGroupPage.loaded && selectedGroupPage.status !== "error"
        ? groupsTotal
        : null;

  return (
    <div className="library-toolbar">
      <CollectionCountHeading
        kind={kind}
        count={count}
        prefix={favorites ? t.favorites : undefined}
      />
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
