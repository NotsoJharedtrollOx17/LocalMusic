import { useState } from "react";
import { ListFilter } from "lucide-react";
import { IconButton } from "../components";
import { ActionMenu } from "../ux";
import { useMusicAppContext } from "./MusicAppContext";

export default function LibraryActions() {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const {
    section,
    group,
    artistView,
    selectedList,
    sort,
    setSort,
    onlyFavorites,
    setOnlyFavorites,
    selectionMode,
    setSelectionMode,
    setSelectedIds,
    t,
  } = useMusicAppContext();
  const canSelect =
    section === "songs" ||
    (group && artistView === "tracks") ||
    (section === "playlists" && !!selectedList);
  if (!canSelect) return null;
  return (
    <>
      <IconButton
        label={t.libraryActions}
        onClick={(e) => setAnchor(e.currentTarget)}
      >
        <ListFilter size={25} />
      </IconButton>
      {anchor && (
        <ActionMenu
          anchor={anchor}
          label={t.libraryActions}
          onClose={() => setAnchor(null)}
          items={[
            ...(canSelect
              ? [
                  {
                    label: t.selectSongs,
                    action: () => {
                      setSelectionMode(!selectionMode);
                      setSelectedIds([]);
                    },
                  },
                ]
              : []),
            ...(section === "songs" && !group
              ? [
                  {
                    label: onlyFavorites ? t.allMusic : t.favorites,
                    action: () => setOnlyFavorites(!onlyFavorites),
                  },
                  ...(["title", "artist", "album"] as const).map((value) => ({
                    label:
                      value === "title"
                        ? t.sort
                        : value === "artist"
                          ? t.sortArtist
                          : t.sortAlbum,
                    checked: sort === value,
                    action: () => setSort(value),
                  })),
                ]
              : []),
          ]}
        />
      )}
    </>
  );
}
