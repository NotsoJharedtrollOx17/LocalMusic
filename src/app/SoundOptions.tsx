import { ChevronRight } from "lucide-react";
import { useMusicAppContext } from "./MusicAppContext";
import { soundCopy } from "../sound/copy";

export default function SoundOptions() {
  const { setModal, soundController, settings, t } = useMusicAppContext();
  const config = soundController.draft;
  const copy = soundCopy(settings?.language ?? "en");
  const profile = config.profiles.find((p) => p.id === config.profileId);
  const preset =
    config.personalEnabled &&
    soundController.state?.personalAvailable &&
    profile
      ? profile.name
      : (copy.presetNames[config.presetId as keyof typeof copy.presetNames] ??
        copy.custom);
  return (
    <div className="sound-option-list">
      <button
        className="sound-option"
        data-sound-view="equalizer"
        onClick={() => setModal("equalizer")}
      >
        <span>
          <strong>{t.equalizer}</strong>
          <small>{preset}</small>
        </span>
        <ChevronRight aria-hidden="true" />
      </button>
      <button
        className="sound-option"
        data-sound-view="adapt"
        onClick={() => setModal("adapt")}
      >
        <span>
          <strong>{t.adaptSound}</strong>
          <small>
            {config.personalEnabled && profile ? profile.name : t.adaptHint}
          </small>
        </span>
        <ChevronRight aria-hidden="true" />
      </button>
    </div>
  );
}
