import { periodFor } from "../recap/periods";
import { useMusicAppContext } from "./MusicAppContext";

export default function RecapPeriodControls() {
  const { settings, recapSelection, recap, snapshotMode, chooseKind, t } =
    useMusicAppContext();
  const selected =
    snapshotMode && recap ? recap.period : periodFor(recapSelection);
  return (
    <div className="recap-period-controls">
      <div
        className="segmented recap-timeframes"
        role="group"
        aria-label={t.timeframe}
      >
        {(["week", "month", "year"] as const).map((kind) => (
          <button
            key={kind}
            type="button"
            aria-pressed={selected.kind === kind}
            disabled={!settings}
            onClick={() => chooseKind(kind)}
          >
            {
              t[
                kind === "week"
                  ? "weekly"
                  : kind === "month"
                    ? "monthly"
                    : "yearly"
              ]
            }
          </button>
        ))}
      </div>
    </div>
  );
}
