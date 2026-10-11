import SoundPresetList from "./SoundPresetList";
import { soundCopy } from "./copy";
import type { PersonalProfile, SoundConfig } from "./types";
export default function SoundPresetSection({
  config,
  edit,
  language,
  profile,
  busy,
}: {
  config: SoundConfig;
  edit: (update: (config: SoundConfig) => SoundConfig) => void;
  language: string;
  profile?: PersonalProfile;
  busy: boolean;
}) {
  const t = soundCopy(language);
  if (!profile)
    return (
      <fieldset className="sound-fieldset" disabled={busy}>
        <SoundPresetList config={config} edit={edit} language={language} />
      </fieldset>
    );
  return (
    <div className="active-personal-profile">
      <div className="sound-heading">
        <h4>{profile.name}</h4>
        <button
          className="button secondary"
          disabled={busy}
          onClick={() => edit((c) => ({ ...c, personalEnabled: false }))}
        >
          {t.disableProfile}
        </button>
      </div>
      <p>{t.priority}</p>
      <details className="inactive-presets">
        <summary>{t.ordinaryPresets}</summary>
        <fieldset disabled className="sound-fieldset">
          <SoundPresetList config={config} edit={edit} language={language} />
        </fieldset>
      </details>
    </div>
  );
}
