import { api } from "../api";
import { Modal } from "../components";
import { usePlayerContext } from "./PlayerContext";
import { useRef } from "react";
import { useInteractionScope } from "../ux/useInteractionScope";

export default function AddPlaylistDialog() {
  const {
    lists,
    busy,
    setBusy,
    setNotice,
    modal,
    setModal,
    setManualTitle,
    setManualIds,
    actionIds,
    t,
    act,
    refreshLists,
  } = usePlayerContext();
  const writing = useRef(false);
  const capture = useInteractionScope(modal);

  return (
    <>
      {modal === "add" && (
        <Modal
          title={t.addSelected}
          closeLabel={t.close}
          onClose={() => setModal(null)}
        >
          <div className="playlist-destinations">
            {lists.map((p) => (
              <button
                className="button secondary full-width"
                disabled={busy}
                key={p.id}
                onClick={() => {
                  if (writing.current) return;
                  writing.current = true;
                  const current = capture();
                  setBusy(true);
                  void act(async () => {
                    await api.savePlaylist({
                      ...p,
                      trackIds: [...new Set([...p.trackIds, ...actionIds])],
                    });
                    await refreshLists();
                    if (current()) setModal(null);
                    setNotice(t.addedPlaylist);
                  }).finally(() => {
                    writing.current = false;
                    setBusy(false);
                  });
                }}
              >
                {p.title}
              </button>
            ))}
            <button
              className="text-button"
              disabled={busy}
              onClick={() => {
                setManualTitle("");
                setManualIds(actionIds);
                setModal("manual");
              }}
            >
              {t.newPlaylist}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
