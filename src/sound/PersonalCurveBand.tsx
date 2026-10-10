import { soundCopy } from "./copy";
import { formatGain } from "./formatGain";
export default function PersonalCurveBand({
  frequency,
  left,
  right,
  inactive,
  language,
}: {
  frequency: number;
  left: number;
  right: number;
  inactive: boolean;
  language: string;
}) {
  const t = soundCopy(language);
  return (
    <div className={`personal-curve-band${inactive ? " inactive" : ""}`}>
      <span>
        {frequency < 1000 ? `${frequency} Hz` : `${frequency / 1000} kHz`}
      </span>
      <div className="personal-ear-pair">
        {[left, right].map((gain, i) => (
          <label key={i}>
            <span>{i === 0 ? t.leftChannel : t.rightChannel}</span>
            <input
              type="range"
              disabled
              min={-12}
              max={12}
              step="any"
              value={gain}
              aria-label={`${frequency} Hz ${t.gain} ${i === 0 ? t.leftChannel : t.rightChannel}`}
              aria-valuetext={formatGain(gain)}
            />
            <output>{formatGain(gain)}</output>
          </label>
        ))}
      </div>
      {inactive && <small>{t.inactive}</small>}
    </div>
  );
}
