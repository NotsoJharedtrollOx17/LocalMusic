import { songIdentity } from "../library/identity";
import { Check } from "lucide-react";
import { Cover, Modal } from "../components";
import { usePlayerContext } from "./PlayerContext";
import { useEffect, useRef, useState } from "react";
import { useInteractionScope } from "../ux/useInteractionScope";

export default function ManualPlaylistDialog() {
  const {
    setError,
    cache,
    settings,
    setNotice,
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
  const [saving, setSaving] = useState(false);
  const writing = useRef(false),
    draftId = useRef<string | null>(null);
  const capture = useInteractionScope(modal);
  useEffect(() => {
    if (modal === "manual") draftId.current = crypto.randomUUID();
  }, [modal]);

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
              if (writing.current) return;
              if (!manualIds.length) {
                setError(t.emptySelection);
                return;
              }
              writing.current = true;
              setSaving(true);
              const current = capture();
              void saveList({
                id: (draftId.current ??= crypto.randomUUID()),
                title: manualTitle,
                kind: "manual",
                trackIds: manualIds,
              })
                .then((saved) => {
                  if (saved && current()) setModal(null);
                })
                .finally(() => {
                  writing.current = false;
                  setSaving(false);
                });
            }}
          >
            <label>
              {t.playlistName}
              <input
                disabled={saving}
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
                disabled={saving}
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
                    disabled={saving}
                    checked={manualIds.includes(track.id)}
                    onChange={(e) => {
                      if (
                        e.target.checked &&
                        manualIds.some(
                          (id) =>
                            cache[id] &&
                            songIdentity(cache[id]) === songIdentity(track),
                        )
                      ) {
                        setNotice(
                          settings?.language === "es"
                            ? "Esta canción ya está en la lista."
                            : "This song is already represented in the playlist.",
                        );
                        return;
                      }
                      setManualIds((ids) =>
                        e.target.checked
                          ? [...ids, track.id]
                          : ids.filter((id) => id !== track.id),
                      );
                    }}
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
                disabled={saving}
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
              disabled={saving || !manualTitle.trim() || !manualIds.length}
              aria-busy={saving}
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
