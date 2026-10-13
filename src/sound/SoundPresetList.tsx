import { BUILT_INS, selectSoundPreset } from "./model";
import { soundCopy } from "./copy";
import type { SoundConfig } from "./types";
export default function SoundPresetList({
  config,
  edit,
  language,
}: {
  config: SoundConfig;
  edit: (update: (c: SoundConfig) => SoundConfig) => void;
  language: string;
}) {
  const t = soundCopy(language);
  return (
    <div className="sound-presets">
      <fieldset aria-label={t.presets}>
        <div className="sound-preset-grid">
          {[...BUILT_INS, { id: "custom", name: t.custom }].map((p) => (
            <button
              type="button"
              key={p.id}
              aria-pressed={config.presetId === p.id}
              onClick={() => edit((c) => selectSoundPreset(c, p.id))}
            >
              {t.presetNames[p.id as keyof typeof t.presetNames] ?? p.name}
            </button>
          ))}
        </div>
      </fieldset>
    </div>
  );
}
