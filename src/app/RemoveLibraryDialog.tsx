import { Modal } from "../components";
import { usePlayerContext } from "./PlayerContext";

export default function RemoveLibraryDialog() {
  const {
    busy,
    setBusy,
    setNotice,
    modal,
    setModal,
    dismissModals,
    setSelectedIds,
    setSelectionMode,
    actionIds,
    setUndoIds,
    t,
    formatMusicCount,
    act,
    changeVisibility,
  } = usePlayerContext();

  return (
    <>
      {modal === "remove" && (
        <Modal
          compact
          title={t.removeLibrary}
          closeLabel={t.close}
          onClose={() => setModal(null)}
        >
          <p>{formatMusicCount(actionIds.length, true)}</p>
          <p className="operation-note">{t.removeLibraryHint}</p>
          <button
            className="button primary full-width"
            disabled={busy}
            onClick={() => {
              setBusy(true);
              void act(async () => {
                await changeVisibility(actionIds, false);
                setUndoIds(actionIds);
                setSelectedIds([]);
                setSelectionMode(false);
                dismissModals();
                setNotice("");
              }).finally(() => setBusy(false));
            }}
          >
            {t.removeLibrary}
          </button>
        </Modal>
      )}
    </>
  );
}
