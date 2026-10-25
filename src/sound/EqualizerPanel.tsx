import type { SoundController } from "./useSoundController";
import type { SoundState } from "./types";
import SoundPresetSection from "./SoundPresetSection";
import EqualizerBands from "./EqualizerBands";

export default function EqualizerPanel({
  controller,
  language,
}: {
  controller: SoundController & { state: SoundState };
  language: string;
}) {
  const { state, draft, edit, flush } = controller;
  return (
    <section>
      <SoundPresetSection
        config={draft}
        edit={edit}
        language={language}
        busy={controller.acting}
      />
      <fieldset className="sound-fieldset" disabled={controller.acting}>
        <EqualizerBands
          config={draft}
          edit={edit}
          flush={flush}
          inactive={state.inactiveBands}
          language={language}
        />
      </fieldset>
    </section>
  );
}
