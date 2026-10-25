import { periodLabel, periodRequest } from "../recap/periods";
import { ArrowUpRight } from "lucide-react";
import { coverageThrough } from "../domain";
import { Modal } from "../components";
import { useMusicAppContext } from "./MusicAppContext";

export default function SnapshotsDialog() {
  const {
    setRecap,
    setRecapLoading,
    setRecapError,
    setSnapshotMode,
    snapshots,
    setRecapSelection,
    modal,
    setModal,
    t,
    settings,
    remember,
    recapRequest,
    formatMinutes,
    formatDate,
  } = useMusicAppContext();

  return (
    <>
      {modal === "snapshots" && (
        <Modal
          closeLabel={t.close}
          title={t.savedSnapshots}
          onClose={() => setModal(null)}
        >
          {snapshots.length ? (
            snapshots.map((r, i) => (
              <button
                className="snapshot-row"
                key={i}
                onClick={() => {
                  ++recapRequest.current;
                  setRecapSelection(periodRequest(r.period));
                  setRecapLoading(false);
                  setRecapError("");
                  setRecap(r);
                  setSnapshotMode(true);
                  remember(r.topTracks.map((x) => x.track));
                  setModal(null);
                }}
              >
                <span>
                  {periodLabel(r.period, settings?.language)} ·{" "}
                  {formatDate(coverageThrough(r).toISOString(), r.timeZone)}
                </span>
                <strong>
                  {formatMinutes(r.listenedMs)} {t.minutes.toLowerCase()}
                </strong>
                <ArrowUpRight size={18} />
              </button>
            ))
          ) : (
            <p className="empty-small">{t.noSnapshot}</p>
          )}
        </Modal>
      )}
    </>
  );
}
