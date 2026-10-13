import { soundCopy } from "./copy";
import { formatGain } from "./formatGain";
import type { CSSProperties } from "react";
export default function PersonalCurveBand({
  frequency,
  gain,
  channel,
  inactive,
  language,
}: {
  frequency: number;
  gain: number;
  channel: string;
  inactive: boolean;
  language: string;
}) {
  const t = soundCopy(language);
  return (
    <label
      className={`equalizer-band personal-curve-band${inactive ? " inactive" : ""}`}
    >
      <span>
        {frequency < 1000 ? `${frequency} Hz` : `${frequency / 1000} kHz`}
      </span>
      <input
        type="range"
        disabled
        min={-10}
        max={10}
        step="any"
        value={gain}
        aria-label={`${frequency} Hz ${t.gain} ${channel}`}
        aria-valuetext={formatGain(gain)}
        style={
          { "--gain-position": `${((gain + 10) / 20) * 100}%` } as CSSProperties
        }
      />
      <output>{formatGain(gain)}</output>
      {inactive && <small>{t.inactive}</small>}
    </label>
  );
}
