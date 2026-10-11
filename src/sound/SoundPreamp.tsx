import type { SoundConfig } from "./types";
import { soundCopy } from "./copy";
import { formatGain } from "./formatGain";
export default function SoundPreamp({
  config,
  edit,
  flush,
  language,
}: {
  config: SoundConfig;
  edit: (update: (c: SoundConfig) => SoundConfig) => void;
  flush: () => void;
  language: string;
}) {
  const t = soundCopy(language);
  return (
    <div className="sound-preamp-control">
      <label className="equalizer-band sound-preamp">
        <span>{t.preamp}</span>
        <input
          type="range"
          aria-label={t.preamp}
          aria-valuetext={formatGain(config.preamp)}
          min={-12}
          max={12}
          step={0.5}
          value={config.preamp}
          onChange={(e) => {
            const preamp = Number(e.target.value);
            edit((c) => ({ ...c, preamp }));
          }}
          onPointerUp={flush}
          onKeyUp={flush}
        />
        <output>{formatGain(config.preamp)}</output>
      </label>
    </div>
  );
}
