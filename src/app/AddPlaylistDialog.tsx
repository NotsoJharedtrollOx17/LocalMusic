import { api } from "../api";
import { Modal } from "../components";
import { useMusicAppContext } from "./MusicAppContext";

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
  } = useMusicAppContext();

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
                  setBusy(true);
                  void act(async () => {
                    await api.savePlaylist({
                      ...p,
                      trackIds: [...new Set([...p.trackIds, ...actionIds])],
                    });
                    await refreshLists();
                    setModal(null);
                    setNotice(t.addedPlaylist);
                  }).finally(() => setBusy(false));
                }}
              >
                {p.title}
              </button>
            ))}
            <button
              className="text-button"
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
