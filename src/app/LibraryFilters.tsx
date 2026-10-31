import { useState } from "react";
import { ListFilter } from "lucide-react";
import { ActionMenu } from "../ux";
import { useMusicAppContext } from "./MusicAppContext";

export default function LibraryFilters() {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const { section, group, onlyFavorites, setOnlyFavorites, sort, setSort, t } =
    useMusicAppContext();
  // Collection details keep their original album order; these are Library song filters.
  if (section !== "songs" || group) return null;
  return (
    <>
      <button
        type="button"
        className="icon-button"
        data-library-filters
        aria-label={t.libraryFilters}
        aria-haspopup="menu"
        aria-expanded={!!anchor}
        onClick={(e) => setAnchor(e.currentTarget)}
      >
        <ListFilter size={25} />
      </button>
      {anchor && (
        <ActionMenu
          anchor={anchor}
          label={t.libraryFilters}
          onClose={() => setAnchor(null)}
          items={[
            {
              id: "favorites",
              label: t.favorites,
              checked: onlyFavorites,
              action: () => setOnlyFavorites(true),
            },
            ...(["title", "artist", "album"] as const).map((value) => ({
              id: value,
              label:
                value === "title"
                  ? t.sort
                  : value === "artist"
                    ? t.sortArtist
                    : t.sortAlbum,
              checked: !onlyFavorites && sort === value,
              action: () => {
                setOnlyFavorites(false);
                setSort(value);
              },
            })),
          ]}
        />
      )}
    </>
  );
}
