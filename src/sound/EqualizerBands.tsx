import type { CSSProperties } from "react";
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
  const available = EQ_BANDS.filter((band) => !inactive.includes(band.index));
  const range = (low: number, high: number) => {
    const bands = available.filter(
      (b) => b.frequency >= low && b.frequency <= high,
    );
    const format = (f: number) => (f < 1000 ? `${f} Hz` : `${f / 1000} kHz`);
    return !bands.length
      ? ""
      : bands.length === 1
        ? format(bands[0].frequency)
        : `${format(bands[0].frequency)}\u2013${format(bands.at(-1)!.frequency)}`;
  };
  return (
    <>
      <div
        className="equalizer-bands"
        style={
          {
            "--available-bands": Math.max(1, available.length),
          } as CSSProperties
        }
      >
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
                aria-describedby={
                  inactive.includes(i) ? "equalizer-inactive" : undefined
                }
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
            </label>
          ))}
        </EqualizerGrid>
        <div className="equalizer-frequency-guide">
          {[
            [t.bass, range(63, 250)],
            [t.mids, range(500, 2000)],
            [t.treble, range(4000, 16000)],
          ]
            .filter(([, frequencies]) => frequencies)
            .map(([label, frequencies]) => (
              <span key={label}>
                {label}
                <small>{frequencies}</small>
              </span>
            ))}
        </div>
        {inactive.length > 0 && (
          <p
            id="equalizer-inactive"
            className="equalizer-inactive-note"
            role="status"
          >
            {t.inactive}:{" "}
            {EQ_BANDS.filter((band) => inactive.includes(band.index))
              .map((band) => `${band.frequency} Hz`)
              .join(", ")}
            .
          </p>
        )}
      </div>
    </>
  );
}
