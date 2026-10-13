import { useState, useEffect, useRef } from "react";
import type { SoundController } from "./useSoundController";
import type { SoundState, PersonalProfile } from "./types";
import PersonalProfiles from "./PersonalProfiles";
import PersonalWizard from "./PersonalWizard";
import PersonalCurveBands from "./PersonalCurveBands";
import { api } from "../api";
import { soundCopy } from "./copy";

export default function AdaptSoundPanel({
  controller,
  language,
  canResume,
}: {
  controller: SoundController & { state: SoundState };
  language: string;
  canResume: boolean;
}) {
  const { state, draft, edit, flush, refresh, action } = controller;
  const [setup, setSetup] = useState(false);
  const [replacement, setReplacement] = useState<PersonalProfile>();
  const [resumeError, setResumeError] = useState("");
  const wasSetup = useRef(false);
  useEffect(() => {
    if (wasSetup.current && !setup)
      document
        .querySelector<HTMLElement>(".personal-profiles h3")
        ?.focus({ preventScroll: true });
    wasSetup.current = setup;
  }, [setup]);
  const profile =
    draft.personalEnabled && state.personalAvailable
      ? draft.profiles.find((p) => p.id === draft.profileId)
      : undefined;
  if (setup)
    return (
      <PersonalWizard
        language={language}
        replacement={replacement}
        routeMonitoring={state.routeMonitoring}
        onDone={() => {
          setSetup(false);
          void refresh();
        }}
      />
    );
  return (
    <>
      <PersonalProfiles
        config={draft}
        edit={edit}
        language={language}
        available={state.supported && state.personalAvailable}
        onUse={(id) =>
          void action({
            op: "profile-use",
            id,
            routeGeneration: state.routeGeneration ?? 0,
          })
        }
        routeGeneration={state.routeGeneration ?? 0}
        busy={controller.acting}
        onSetup={(p) => {
          setReplacement(p);
          flush();
          setSetup(true);
        }}
      />
      {profile && (
        <PersonalCurveBands
          left={profile.left}
          right={profile.right}
          strength={draft.strength}
          inactive={state.inactiveBands}
          language={language}
        />
      )}
      {canResume && (
        <button
          className="button secondary"
          onClick={() =>
            void api.toggle().catch((e) => setResumeError(String(e)))
          }
        >
          {soundCopy(language).resume}
        </button>
      )}
      {resumeError && <p role="alert">{resumeError}</p>}
    </>
  );
}
