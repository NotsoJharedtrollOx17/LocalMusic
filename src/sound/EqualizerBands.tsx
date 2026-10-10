import { FREQUENCIES, type SoundConfig } from "./types";
import { soundCopy } from "./copy";
export default function EqualizerBands({
  config,
  edit,
  flush,
  inactive,
  language,
}: {
  config: SoundConfig;
  edit: (update: (c: SoundConfig) => SoundConfig) => void;
  flush: () => void;
  inactive: number[];
  language: string;
}) {
  const t = soundCopy(language);
  return (
    <>
      <div className="equalizer-bands">
        {FREQUENCIES.map((f, i) => (
          <label
            className={`equalizer-band${inactive.includes(i) ? " inactive" : ""}`}
            key={f}
          >
            <span>{f < 1000 ? `${f} Hz` : `${f / 1000} kHz`}</span>
            <input
              type="range"
              aria-label={`${f} Hz ${t.gain}`}
              aria-valuetext={`${config.gains[i]} dB`}
              disabled={inactive.includes(i)}
              min={-12}
              max={12}
              step={0.5}
              value={config.gains[i]}
              onChange={(e) => {
                const value = Number(e.target.value);
                edit((c) => ({
                  ...c,
                  presetId: "custom",
                  gains: c.gains.map((g, j) => (i === j ? value : g)),
                }));
              }}
              onPointerUp={flush}
              onKeyUp={flush}
            />
            <output>
              {config.gains[i] > 0 ? "+" : ""}
              {config.gains[i]} dB
            </output>
            {inactive.includes(i) && <small>{t.inactive}</small>}
          </label>
        ))}
      </div>
      <label className="sound-preamp">
        {t.preamp} <output>{config.preamp} dB</output>
        <input
          type="range"
          aria-label={t.preamp}
          aria-valuetext={`${config.preamp} dB`}
          min={-12}
          max={0}
          step={0.5}
          value={config.preamp}
          onChange={(e) => {
            const preamp = Number(e.target.value);
            edit((c) => ({ ...c, preamp, presetId: "custom" }));
          }}
          onPointerUp={flush}
          onKeyUp={flush}
        />
      </label>
    </>
  );
}
