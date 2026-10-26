import { periodLabel } from "../recap/periods";
import { ArrowLeft, ArrowRight, Play, Share2 } from "lucide-react";
import { api } from "../api";
import { IconButton, Modal, OrbitPoster } from "../components";
import { useMusicAppContext } from "./MusicAppContext";
import RecapListening from "./RecapListening";
import RecapRankings from "./RecapRankings";

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

  const topIds =
    recap?.topTracks
      .slice(0, 10)
      .filter((x) => x.track.available && !x.track.hidden)
      .map((x) => x.track.id) ?? [];
  return (
    <>
      {modal === "story" && recap && (
        <Modal
          closeLabel={t.close}
          title={t.story}
          onClose={() => setModal(null)}
        >
          <div className="story-progress">
            {Array.from({ length: 7 }, (_, i) => (
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
              <RecapRankings category="songs" />
            ) : story === 3 ? (
              <RecapRankings category="artists" />
            ) : story === 4 ? (
              <RecapRankings category="albums" />
            ) : story === 5 ? (
              <>
                <p className="eyebrow">{t.monthTitle}</p>
                <RecapListening />
                <p>{t.monthStory}</p>
              </>
            ) : (
              <>
                <p className="eyebrow">{t.recapTopTen}</p>
                <h2>{formatMusicCount(topIds.length)}</h2>
                <button
                  className="button primary"
                  disabled={!topIds.length}
                  onClick={() => void act(() => api.play(topIds))}
                >
                  <Play size={18} />
                  {t.playTopTen}
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
              {story + 1} {t.of} 7
            </span>
            {story < 6 ? (
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
