import { ChevronLeft, ChevronRight } from "lucide-react";
import { IconButton } from "../components";
import { periodFor, periodLabel, periodRequest } from "../recap/periods";
import { useMusicAppContext } from "./MusicAppContext";

export default function RecapPeriodControls() {
  const {
    settings,
    recapSelection,
    recap,
    snapshotMode,
    periodOptions,
    currentPeriod,
    chooseKind,
    choosePeriod,
    t,
  } = useMusicAppContext();
  const selected =
    snapshotMode && recap ? recap.period : periodFor(recapSelection);
  const choices = periodOptions.some((p) => p.startDate === selected.startDate)
    ? periodOptions
    : [selected, ...periodOptions];
  const i = choices.findIndex((p) => p.startDate === selected.startDate),
    language = settings?.language ?? "en";
  const years = [...new Set(choices.map((p) => p.startDate.slice(0, 4)))];
  const option = (p: typeof selected) => (
    <option key={p.startDate} value={p.startDate}>
      {periodLabel(p, language)}
    </option>
  );
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
      <div className="recap-period-navigation">
        <IconButton
          label={t.previousPeriod}
          disabled={i < 0 || i === choices.length - 1}
          onClick={() => choosePeriod(periodRequest(choices[i + 1]))}
        >
          <ChevronLeft />
        </IconButton>
        <select
          aria-label={t.recapPeriod}
          value={selected.startDate}
          disabled={!settings}
          onChange={(e) =>
            choosePeriod({ kind: selected.kind, anchorDate: e.target.value })
          }
        >
          {selected.kind === "year"
            ? choices.map(option)
            : years.map((year) => (
                <optgroup key={year} label={year}>
                  {choices
                    .filter((p) => p.startDate.startsWith(year))
                    .map(option)}
                </optgroup>
              ))}
        </select>
        <IconButton
          label={t.nextPeriod}
          disabled={i <= 0}
          onClick={() => choosePeriod(periodRequest(choices[i - 1]))}
        >
          <ChevronRight />
        </IconButton>
        {currentPeriod && currentPeriod.startDate !== selected.startDate && (
          <button
            className="text-button"
            onClick={() => choosePeriod(periodRequest(currentPeriod))}
          >
            {t.currentPeriod}
          </button>
        )}
      </div>
    </div>
  );
}
