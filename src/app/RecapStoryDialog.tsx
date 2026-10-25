import { periodLabel } from "../recap/periods";
import { ArrowLeft, ArrowRight, Play, Share2 } from "lucide-react";
import { api } from "../api";
import { Cover, IconButton, Modal, OrbitPoster } from "../components";
import { useMusicAppContext } from "./MusicAppContext";
import RecapListening from "./RecapListening";

export default function RecapStoryDialog() {
  const {
    recap,
    settings,
    setShareRecap,
    recapLoading,
    modal,
    setModal,
    story,
    setStory,
    t,
    formatMusicCount,
    act,
    formatMinutes,
    formatDate,
  } = useMusicAppContext();

  return (
    <>
      {modal === "story" && recap && (
        <Modal
          closeLabel={t.close}
          title={t.story}
          onClose={() => setModal(null)}
        >
          <div className="story-progress">
            {Array.from({ length: 6 }, (_, i) => (
              <button
                key={i}
                aria-label={String(i + 1)}
                className={i === story ? "current" : ""}
                onClick={() => setStory(i)}
              />
            ))}
          </div>
          <div className="story-scene">
            {story === 0 ? (
              <>
                <OrbitPoster
                  title={periodLabel(recap.period, settings?.language)}
                  seed={recap.visualSeed}
                  label={t.inSound}
                />
                <h2>{t.year}</h2>
                <p>
                  {t.since} {formatDate(recap.coveredFrom, recap.timeZone)}
                </p>
              </>
            ) : story === 1 ? (
              <>
                <p className="eyebrow">{t.minutesListened}</p>
                <strong className="story-number">
                  {formatMinutes(recap.listenedMs)}
                </strong>
                <p>
                  {recap.activeDays} {t.listeningDays}
                </p>
              </>
            ) : story === 2 ? (
              <>
                <p className="eyebrow">{t.topTrack}</p>
                {recap.topTracks[0] && (
                  <Cover track={recap.topTracks[0].track} large />
                )}
                <h2>{recap.topTracks[0]?.track.title || t.noPlays}</h2>
                <p>{recap.topTracks[0]?.track.artist}</p>
              </>
            ) : story === 3 ? (
              <>
                <p className="eyebrow">{t.topArtist}</p>
                <h2>{recap.topArtist?.name || t.noPlays}</h2>
                <p className="eyebrow">{t.topAlbum}</p>
                <h2>{recap.topAlbum?.name || "—"}</h2>
              </>
            ) : story === 4 ? (
              <>
                <p className="eyebrow">{t.monthTitle}</p>
                <RecapListening />
                <p>{t.monthStory}</p>
              </>
            ) : (
              <>
                <p className="eyebrow">{t.yearTracks}</p>
                <h2>{formatMusicCount(recap.trackIds.length)}</h2>
                <button
                  className="button primary"
                  disabled={!recap.trackIds.length}
                  onClick={() => void act(() => api.play(recap.trackIds))}
                >
                  <Play size={18} />
                  {t.playYear}
                </button>
                <button
                  className="button secondary"
                  disabled={!recap.listenedMs || recapLoading}
                  onClick={() => {
                    setModal(null);
                    setShareRecap(recap);
                  }}
                >
                  <Share2 size={18} />
                  {t.shareCard}
                </button>
              </>
            )}
          </div>
          <div className="story-controls">
            <IconButton
              label={t.previous}
              disabled={!story}
              onClick={() => setStory(story - 1)}
            >
              <ArrowLeft />
            </IconButton>
            <span>
              {story + 1} {t.of} 6
            </span>
            {story < 5 ? (
              <IconButton label={t.next} onClick={() => setStory(story + 1)}>
                <ArrowRight />
              </IconButton>
            ) : (
              <button className="text-button" onClick={() => setModal(null)}>
                {t.done}
              </button>
            )}
          </div>
        </Modal>
      )}
    </>
  );
}
