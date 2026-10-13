import { useState } from "react";
import { Settings2 } from "lucide-react";
import { ActionMenu } from "../ux";
import { useMusicAppContext } from "./MusicAppContext";

export default function LibraryActions() {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const {
    section,
    group,
    artistView,
    selectedList,
    setModal,
    openSound,
    selectionMode,
    setSelectionMode,
    setSelectedIds,
    t,
  } = useMusicAppContext();
  const canSelect =
    section === "songs" ||
    (group && (group.kind === "albums" || artistView === "tracks")) ||
    (section === "playlists" && !!selectedList);
  return (
    <>
      <button
        className="icon-button"
        type="button"
        data-library-menu
        aria-label={t.libraryActions}
        aria-haspopup="menu"
        aria-expanded={!!anchor}
        onClick={(e) => setAnchor(e.currentTarget)}
      >
        <Settings2 size={25} />
      </button>
      {anchor && (
        <ActionMenu
          anchor={anchor}
          label={t.libraryActions}
          onClose={() => setAnchor(null)}
          items={[
            {
              label: t.edit,
              disabled: !canSelect,
              action: () => {
                setSelectionMode(!selectionMode);
                setSelectedIds([]);
              },
            },
            { label: t.soundControls, action: () => void openSound() },
            { label: t.settings, action: () => setModal("settings") },
          ]}
        />
      )}
    </>
  );
}
