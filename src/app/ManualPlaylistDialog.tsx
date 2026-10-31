import { Check } from "lucide-react";
import { Cover, Modal } from "../components";
import { usePlayerContext } from "./PlayerContext";

export default function ManualPlaylistDialog() {
  const {
    setError,
    modal,
    setModal,
    pickerTracks,
    pickerTotal,
    pickerQuery,
    setPickerQuery,
    manualTitle,
    setManualTitle,
    manualIds,
    setManualIds,
    t,
    act,
    refreshPicker,
    saveList,
  } = usePlayerContext();

  return (
    <>
      {modal === "manual" && (
        <Modal
          closeLabel={t.close}
          title={t.newPlaylist}
          onClose={() => setModal(null)}
          wide
        >
          <form
            className="manual-playlist-form"
            onSubmit={(e) => {
              e.preventDefault();
              if (!manualIds.length) {
                setError(t.emptySelection);
                return;
              }
              void act(async () => {
                await saveList({
                  id: crypto.randomUUID(),
                  title: manualTitle,
                  kind: "manual",
                  trackIds: manualIds,
                });
                setModal(null);
              });
            }}
          >
            <label>
              {t.playlistName}
              <input
                value={manualTitle}
                required
                maxLength={120}
                onChange={(e) => setManualTitle(e.target.value)}
              />
            </label>
            <p className="eyebrow choose-tracks-label">{t.chooseTracks}</p>
            <label>
              {t.search}
              <input
                value={pickerQuery}
                onChange={(e) => setPickerQuery(e.target.value)}
              />
            </label>
            <div className="track-picker">
              {pickerTracks.length === 0 && (
                <p className="empty-small">{t.noResults}</p>
              )}
              {pickerTracks.map((track) => (
                <label key={track.id}>
                  <input
                    type="checkbox"
                    checked={manualIds.includes(track.id)}
                    onChange={(e) =>
                      setManualIds((ids) =>
                        e.target.checked
                          ? [...ids, track.id]
                          : ids.filter((id) => id !== track.id),
                      )
                    }
                  />
                  <Cover track={track} />
                  <span>
                    <strong>{track.title}</strong>
                    <small>{track.artist || t.unknownArtist}</small>
                  </span>
                </label>
              ))}
            </div>
            {pickerTracks.length < pickerTotal && (
              <button
                className="text-button"
                type="button"
                onClick={() =>
                  void act(() =>
                    refreshPicker(pickerQuery, pickerTracks.length),
                  )
                }
              >
                {t.loadMore}
              </button>
            )}
            <button
              className="button primary full-width"
              type="submit"
              disabled={!manualTitle.trim() || !manualIds.length}
            >
              {t.save}
              <Check size={18} />
            </button>
          </form>
        </Modal>
      )}
    </>
  );
}
