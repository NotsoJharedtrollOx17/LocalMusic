import { Heart } from "lucide-react";
import { Cover, Modal, time } from "../components";
import { useMusicAppContext } from "./MusicAppContext";

export default function TrackDetailsDialog() {
  const { lists, modal, setModal, detail, t, act, favorite, saveList } =
    useMusicAppContext();

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
            <dl>
              <div>
                <dt>{t.albums}</dt>
                <dd>{detail.album || t.unknownAlbum}</dd>
              </div>
              <div>
                <dt>{t.genre}</dt>
                <dd>{detail.genre || "—"}</dd>
              </div>
              <div>
                <dt>{t.duration}</dt>
                <dd>{time(detail.durationMs)}</dd>
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
                defaultValue=""
                onChange={(e) =>
                  void act(async () => {
                    const p = lists.find((x) => x.id === e.target.value);
                    if (p) {
                      await saveList({
                        ...p,
                        trackIds: [...new Set([...p.trackIds, detail.id])],
                      });
                      setModal(null);
                    }
                  })
                }
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
