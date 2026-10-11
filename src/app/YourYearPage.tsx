import {
  ArrowUpRight,
  Play,
  Repeat,
  Share2,
  MoreHorizontal,
} from "lucide-react";
import { api } from "../api";
import { coverageThrough } from "../domain";
import { IconButton, OrbitPoster } from "../components";
import { useMusicAppContext } from "./MusicAppContext";
import TrackRows from "./TrackRows";
import MonthlyListening from "./MonthlyListening";

export default function YourYearPage() {
  const {
    cache,
    recap,
    setShareRecap,
    recapLoading,
    setRecapRevision,
    snapshotMode,
    setSnapshotMode,
    setSnapshots,
    year,
    setYear,
    setNotice,
    setModal,
    setStory,
    t,
    yearOptions,
    act,
    formatMinutes,
    formatDate,
  } = useMusicAppContext();

  return (
    <section className="year-page">
      <div className="page-heading">
        <div>
          <h2>{t.year}</h2>
        </div>
        <div className="year-controls">
          <select
            aria-label={t.year}
            value={year}
            onChange={(e) => {
              setSnapshotMode(false);
              setYear(Number(e.target.value));
            }}
          >
            {yearOptions.map((y) => (
              <option key={y}>{y}</option>
            ))}
          </select>
          <IconButton
            label={snapshotMode ? t.liveRecap : t.refreshRecap}
            onClick={() => {
              setSnapshotMode(false);
              setRecapRevision((v) => v + 1);
            }}
          >
            <Repeat size={20} />
          </IconButton>
          <IconButton
            label={t.savedSnapshots}
            onClick={() => setModal("snapshots")}
          >
            <MoreHorizontal />
          </IconButton>
        </div>
      </div>
      <OrbitPoster
        year={recap?.year === year ? recap.year : year}
        seed={recap?.visualSeed ?? "ff6600"}
        label={t.inSound}
      />
      {recapLoading && (
        <p role="status" className="small-muted">
          {t.loading}
        </p>
      )}
      {recap && recap.year === year && (
        <>
          <div className="recap-coverage">
            <span>
              {snapshotMode
                ? t.snapshot
                : recap.completeYear
                  ? t.fullYear
                  : t.partialYear}
            </span>
            <span>
              {t.since} {formatDate(recap.coveredFrom, recap.timeZone)} ·{" "}
              {t.through}{" "}
              {formatDate(coverageThrough(recap).toISOString(), recap.timeZone)}
            </span>
          </div>
          <div className="recap-total">
            <strong>{formatMinutes(recap.listenedMs)}</strong>
            <div>
              <span className="eyebrow">{t.minutesListened}</span>
              <small>
                {recap.activeDays} {t.listeningDays} · {recap.qualifiedPlays}{" "}
                {t.qualifiedPlays}
              </small>
            </div>
            <button
              className="text-button"
              onClick={() => {
                setStory(0);
                setModal("story");
              }}
            >
              {t.viewRecap}
              <ArrowUpRight size={18} />
            </button>
          </div>
          <MonthlyListening />
          <p className="month-caption">
            {recap.listenedMs ? t.monthStory : t.recapEmpty}
          </p>
          <div className="recap-highlights">
            <div>
              <span className="eyebrow">01 / {t.topArtist}</span>
              <h2>{recap.topArtist?.name || "—"}</h2>
              <span>
                {recap.topArtist
                  ? recap.topArtist.plays + " " + t.plays
                  : t.noPlays}
              </span>
            </div>
            <div>
              <span className="eyebrow">02 / {t.topTrack}</span>
              <h2>{recap.topTracks[0]?.track.title || "—"}</h2>
              <span>
                {recap.topTracks[0]
                  ? recap.topTracks[0].plays + " " + t.plays
                  : t.noPlays}
              </span>
            </div>
            <div>
              <span className="eyebrow">03 / {t.topAlbum}</span>
              <h2>{recap.topAlbum?.name || "—"}</h2>
              <span>{recap.topAlbum?.artist || t.noPlays}</span>
            </div>
          </div>
          <div className="recap-actions">
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
            <button
              className="text-button"
              onClick={() =>
                void act(async () => {
                  await api.saveSnapshot(recap);
                  setSnapshots(await api.snapshots());
                  setNotice(t.snapshotSaved);
                })
              }
            >
              {t.saveSnapshot}
            </button>
          </div>
          {!recap.listenedMs && (
            <p className="small-muted">{t.recapEmptyBody}</p>
          )}
          <p className="method-note">{t.coverageNote}</p>
          {!!recap.topTracks.length && (
            <div className="recap-track-list">
              <p className="eyebrow">{t.yearTracks}</p>
              {
                <TrackRows
                  ts={recap.topTracks.slice(0, 25).map((x) => ({
                    ...x.track,
                    hidden: cache[x.track.id]?.hidden ?? x.track.hidden,
                  }))}
                  queueIds={recap.trackIds}
                />
              }
            </div>
          )}
        </>
      )}
    </section>
  );
}
