import { useRef, useState } from "react";
import { Settings2 } from "lucide-react";
import { ActionMenu } from "../ux";
import { useMusicAppContext } from "./MusicAppContext";

export default function LibraryActions() {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const includedEdit = useRef(false);
  const {
    section,
    group,
    artistView,
    selectedList,
    editingList,
    visible,
    playlistTracks,
    libraryLoading,
    groupLoading,
    setModal,
    openSound,
    selectionMode,
    setSelectionMode,
    setSelectedIds,
    t,
  } = useMusicAppContext();
  const trackView = group
    ? group.kind === "albums" || artistView === "tracks"
    : section === "songs" || (section === "playlists" && !!selectedList);
  const count =
    section === "playlists" ? playlistTracks.length : visible.length;
  const canSelect =
    !!trackView && !(section === "playlists" && editingList) && count > 0;
  const loading =
    section === "songs" ? libraryLoading : !!group && groupLoading;
  return (
    <>
      <button
        className="icon-button"
        type="button"
        data-library-menu
        aria-label={t.libraryActions}
        aria-haspopup="menu"
        aria-expanded={!!anchor}
        onClick={(event) => {
          includedEdit.current = canSelect || selectionMode;
          setAnchor(event.currentTarget);
        }}
      >
        <Settings2 size={25} />
      </button>
      {anchor && (
        <ActionMenu
          anchor={anchor}
          label={t.libraryActions}
          onClose={() => setAnchor(null)}
          items={[
            ...(includedEdit.current
              ? [
                  {
                    id: "edit",
                    label: selectionMode ? t.doneSelecting : t.edit,
                    disabled: !selectionMode && (!canSelect || loading),
                    action: () => {
                      if (!selectionMode && (!canSelect || loading)) return;
                      setSelectionMode(!selectionMode);
                      setSelectedIds([]);
                    },
                  },
                ]
              : []),
            {
              id: "sound",
              label: t.soundControls,
              action: () => void openSound(),
            },
            {
              id: "settings",
              label: t.settings,
              action: () => setModal("settings"),
            },
          ]}
        />
      )}
    </>
  );
}
