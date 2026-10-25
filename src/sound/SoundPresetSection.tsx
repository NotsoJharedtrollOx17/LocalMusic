import SoundPresetList from "./SoundPresetList";
import type { SoundConfig } from "./types";
export default function SoundPresetSection({
  config,
  edit,
  language,
  busy,
}: {
  config: SoundConfig;
  edit: (update: (config: SoundConfig) => SoundConfig) => void;
  language: string;
  busy: boolean;
}) {
  return (
    <fieldset className="sound-fieldset" disabled={busy}>
      <SoundPresetList config={config} edit={edit} language={language} />
    </fieldset>
  );
}
