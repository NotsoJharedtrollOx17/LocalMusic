import { ChevronDown } from "lucide-react";
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
        <label className="sound-preset-select">
          {t.presets}
          <span className="sound-preset-field">
            <select
              aria-label={t.presets}
              value={config.presetId}
              onChange={(event) =>
                edit((c) => selectSoundPreset(c, event.target.value))
              }
            >
              {[...BUILT_INS, { id: "custom", name: t.custom }].map((p) => (
                <option key={p.id} value={p.id}>
                  {t.presetNames[p.id as keyof typeof t.presetNames] ?? p.name}
                </option>
              ))}
            </select>
            <ChevronDown size={18} aria-hidden="true" />
          </span>
        </label>
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
