import { EQ_BANDS, type SoundConfig } from "./types";
import { soundCopy } from "./copy";
import { saveCustom } from "./model";
import { formatGain } from "./formatGain";
import EqualizerGrid from "./EqualizerGrid";
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
        <EqualizerGrid>
          {EQ_BANDS.map(({ frequency: f, index: i }) => (
            <label
              className={`equalizer-band${inactive.includes(i) ? " inactive" : ""}`}
              key={f}
            >
              <span>{f < 1000 ? f : `${f / 1000}k`}</span>
              <input
                type="range"
                aria-label={`${f} Hz ${t.gain}`}
                aria-valuetext={formatGain(config.gains[i])}
                disabled={inactive.includes(i)}
                min={-10}
                max={10}
                step={0.5}
                value={config.gains[i]}
                onChange={(e) => {
                  const value = Number(e.target.value);
                  edit((c) =>
                    saveCustom(
                      c,
                      c.gains.map((g, j) => (i === j ? value : g)),
                    ),
                  );
                }}
                onPointerUp={flush}
                onKeyUp={flush}
              />
              <output className="sound-sr-only">
                {formatGain(config.gains[i])}
              </output>
              {inactive.includes(i) && <small>{t.inactive}</small>}
            </label>
          ))}
        </EqualizerGrid>
      </div>
    </>
  );
}
