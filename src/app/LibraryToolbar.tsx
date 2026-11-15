import { libraryStrings } from "../library/strings";
import ClearSearchButton from "./ClearSearchButton";
import { Plus, SlidersHorizontal } from "lucide-react";
import { native } from "../api";
import { useMusicAppContext } from "./MusicAppContext";
import LibraryFilters from "./LibraryFilters";
import CollectionCountHeading from "./CollectionCountHeading";

export default function LibraryToolbar() {
  const {
    settings,
    setOrganizationTab,
    setModal,
    total,
    libraryViewPending,
    libraryError,
    section,
    onlyFavorites,
    groupsTotal,
    selectedGroupPage,
    group,
    artistView,
    artistAlbums,
    artistAlbumsLoading,
    busy,
    fileInput,
    t,
    doImport,
  } = useMusicAppContext();
  const songFilters = section === "songs" && !group;
  const favorites = songFilters && onlyFavorites;
  const kind =
    group?.kind === "artists" && artistView === "albums"
      ? "albums"
      : !group && (section === "albums" || section === "artists")
        ? section
        : "songs";
  const count = group
    ? artistView === "albums" && group.kind === "artists"
      ? artistAlbumsLoading && !artistAlbums.length
        ? null
        : artistAlbums.length
      : group.ids.length
    : songFilters
      ? libraryViewPending || libraryError
        ? null
        : total
      : selectedGroupPage.loaded && selectedGroupPage.status !== "error"
        ? groupsTotal
        : null;

  return (
    <div className="library-toolbar" data-collection-kind={group?.kind}>
      <CollectionCountHeading
        kind={kind}
        count={count}
        prefix={favorites ? t.favorites : undefined}
      />
      <div className="toolbar-actions">
        {group?.kind === "albums" && (
          <button
            data-organization-origin
            className="button primary collection-organize-action"
            onClick={() => { setOrganizationTab("albums"); setModal("organize"); }}
          >
            <SlidersHorizontal size={18} aria-hidden="true" />
            {libraryStrings(settings?.language === "es").organize}
          </button>
        )}
        <ClearSearchButton />
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
