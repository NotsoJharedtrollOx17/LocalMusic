import RecapPeriodControls from "./RecapPeriodControls";
import { periodFor, periodLabel } from "../recap/periods";
import { ArrowUpRight, Repeat, Share2, MoreHorizontal } from "lucide-react";
import { api } from "../api";
import { coverageThrough } from "../domain";
import { IconButton, OrbitPoster } from "../components";
import { useMusicAppContext } from "./MusicAppContext";
import RecapRankings from "./RecapRankings";
import RecapTopTen from "./RecapTopTen";
import RecapListening from "./RecapListening";

export default function YourRecapPage() {
  const {
    recap,
    setShareRecap,
    recapLoading,
    recapError,
    setRecapRevision,
    snapshotMode,
    setSnapshots,
    recapSelection,
    returnToLive,
    settings,
    setNotice,
    setModal,
    setStory,
    t,
    act,
    formatMinutes,
    formatDate,
  } = useMusicAppContext();

  const selected = periodFor(recapSelection);
  const shown = Boolean(
    recap &&
    (snapshotMode ||
      (recap.period.kind === selected.kind &&
        recap.period.startDate === selected.startDate &&
        recap.timeZone === settings?.timeZone)),
  );
  return (
    <section className="year-page">
      <div className="page-heading">
        <div>
          <h1 className="recap-heading">{t.year}</h1>
        </div>
        <div className="year-controls">
          <IconButton
            label={snapshotMode ? t.liveRecap : t.refreshRecap}
            onClick={() => {
              if (snapshotMode) returnToLive();
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
      <RecapPeriodControls />
      <OrbitPoster
        title={periodLabel(
          snapshotMode && recap ? recap.period : selected,
          settings?.language,
        )}
        seed={shown ? recap!.visualSeed : "ff6600"}
        label={t.inSound}
      />
      {!shown && !recapError && (
        <p role="status" className="small-muted">
          {t.loading}
        </p>
      )}
      {recapError && <p role="alert">{recapError}</p>}
      {recap && shown && (
        <>
          <div className="recap-coverage">
            <span>
              {snapshotMode
                ? t.snapshot
                : recap.completePeriod
                  ? t.fullYear
                  : Date.parse(recap.coveredThrough) >
                      Date.parse(recap.coveredFrom)
                    ? t.partialYear
                    : t.noCoverage}
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
          <RecapListening />
          <p className="month-caption">
            {recap.listenedMs ? t.monthStory : t.recapEmpty}
          </p>
          <RecapRankings />
          <div className="recap-actions">
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
          <RecapTopTen />
        </>
      )}
    </section>
  );
}
