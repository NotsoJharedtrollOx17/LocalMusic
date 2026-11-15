import { libraryStrings } from "../library/strings";
import { Heart } from "lucide-react";
import { Cover, Modal } from "../components";
import { usePlayerContext } from "./PlayerContext";
import { useRef, useState } from "react";
import { useInteractionScope } from "../ux/useInteractionScope";

export default function TrackDetailsDialog() {
  const {
    lists,
    modal,
    setModal,
    detail,
    t,
    act,
    favorite,
    saveList,
    settings,
    setOrganizationTab,
  } = usePlayerContext();
  const capture = useInteractionScope(`${modal}:${detail?.id}`);
  const writing = useRef(false);
  const [destination, setDestination] = useState("");
  const [saving, setSaving] = useState(false);

  return (
    <>
      {modal === "track" && detail && (
        <Modal
          closeLabel={t.close}
          title={t.details}
          onClose={() => setModal(null)}
        >
          <div className="track-details">
            <Cover track={detail} large />
            <h2>{detail.title}</h2>
            <p>{detail.artist || t.unknownArtist}</p>
            <button
              data-organization-origin
              className="button secondary"
              onClick={() => {
                setOrganizationTab("artists");
                setModal("organize");
              }}
            >
              {libraryStrings(settings?.language === "es").organize}
            </button>
            <dl>
              <div>
                <dt>{t.albums}</dt>
                <dd>{detail.album || t.unknownAlbum}</dd>
              </div>
              <div>
                <dt>{t.genre}</dt>
                <dd>{detail.genre || "—"}</dd>
              </div>

            </dl>
            <button
              className="button secondary full-width"
              onClick={() => void favorite(detail)}
            >
              <Heart
                size={18}
                fill={detail.favorite ? "currentColor" : "none"}
              />
              {t.favorite}
            </button>
            <label>
              {t.addToPlaylist}
              <select
                aria-label={t.addToPlaylist}
                value={destination}
                disabled={saving}
                aria-busy={saving}
                onChange={(e) => {
                  const p = lists.find((x) => x.id === e.target.value);
                  if (!p || writing.current) return;
                  const current = capture();
                  writing.current = true;
                  setSaving(true);
                  setDestination(p.id);
                  void saveList({
                    ...p,
                    trackIds: [...new Set([...p.trackIds, detail.id])],
                  })
                    .then((saved) => {
                      if (saved && current()) setModal(null);
                    })
                    .finally(() => {
                      writing.current = false;
                      setSaving(false);
                      setDestination("");
                    });
                }}
              >
                <option value="" disabled>
                  {t.selectPlaylist}
                </option>
                {lists.map((p) => (
                  <option value={p.id} key={p.id}>
                    {p.title}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </Modal>
      )}
    </>
  );
}
