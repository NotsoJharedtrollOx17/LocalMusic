import type { SoundController } from "./useSoundController";
import type { SoundState } from "./types";
import SoundPresetSection from "./SoundPresetSection";
import EqualizerBands from "./EqualizerBands";
import PersonalCurveBands from "./PersonalCurveBands";

export default function EqualizerPanel({
  controller,
  language,
}: {
  controller: SoundController & { state: SoundState };
  language: string;
}) {
  const { state, draft, edit, flush } = controller;
  const profile =
    draft.personalEnabled && state.personalAvailable
      ? draft.profiles.find((p) => p.id === draft.profileId)
      : undefined;
  return (
    <section>
      <SoundPresetSection
        config={draft}
        edit={edit}
        language={language}
        profile={profile}
        busy={controller.acting}
      />
      <fieldset className="sound-fieldset" disabled={controller.acting}>
        {profile ? (
          <PersonalCurveBands
            left={profile.left}
            right={profile.right}
            strength={draft.strength}
            inactive={state.inactiveBands}
            language={language}
          />
        ) : (
          <EqualizerBands
            config={draft}
            edit={edit}
            flush={flush}
            inactive={state.inactiveBands}
            language={language}
          />
        )}
      </fieldset>
    </section>
  );
}
