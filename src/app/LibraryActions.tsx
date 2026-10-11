import { useState } from "react";
import { MoreHorizontal } from "lucide-react";
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
    onlyFavorites,
    setOnlyFavorites,
    selectionMode,
    setSelectionMode,
    setSelectedIds,
    setModal,
    t,
  } = useMusicAppContext();
  const canSelect =
    section === "songs" ||
    (group && artistView === "tracks") ||
    (section === "playlists" && !!selectedList);
  return (
    <>
      <IconButton
        label={t.libraryActions}
        onClick={(e) => setAnchor(e.currentTarget)}
      >
        <MoreHorizontal size={25} />
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
                ]
              : []),
            { label: t.settings, action: () => setModal("settings") },
          ]}
        />
      )}
    </>
  );
}
