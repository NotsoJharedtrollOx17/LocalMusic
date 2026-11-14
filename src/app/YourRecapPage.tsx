import RecapPeriodControls from "./RecapPeriodControls";
import { periodFor, periodLabel } from "../recap/periods";
import { ArrowUpRight, Repeat, Share2, Info } from "lucide-react";
import OverflowIcon from "../components/OverflowIcon";
import LoadingIndicator from "../components/LoadingIndicator";
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
    recapSelection,
    returnToLive,
    settings,
    setModal,
    setStory,
    t,
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
            <OverflowIcon />
          </IconButton>
        </div>
      </div>
      <RecapPeriodControls />
      <OrbitPoster
        title={periodLabel(
          snapshotMode && recap ? recap.period : selected,
          settings?.language,
        )}
        seed={recap?.visualSeed ?? "ff6600"}
        label={t.inSound}
      />
      <div
        className={"recap-content" + (!shown ? " is-pending" : "")}
        aria-busy={!shown || recapLoading}
      >
        {!shown && (
          <div className="recap-pending">
            {recapError ? (
              <>
                <p role="alert">{recapError}</p>
                <button
                  className="button secondary"
                  onClick={() => setRecapRevision((v) => v + 1)}
                >
                  {t.retry}
                </button>
              </>
            ) : (
              <LoadingIndicator label={t.loading} />
            )}
          </div>
        )}
        {shown && recapError && <p role="alert">{recapError}</p>}
        {recap && (
          <div
            className="recap-confirmed"
            inert={!shown}
            aria-hidden={!shown || undefined}
          >
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
                {formatDate(
                  coverageThrough(recap).toISOString(),
                  recap.timeZone,
                )}
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
            </div>
            {!recap.listenedMs && (
              <p className="small-muted">{t.recapEmptyBody}</p>
            )}
            <RecapTopTen />
            <p className="method-note recap-disclaimer">
              <Info size={16} aria-hidden="true" />
              {t.coverageNote}
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
