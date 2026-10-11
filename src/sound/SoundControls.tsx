import "./sound.css";
import { useState, useEffect, useRef } from "react";
import { api } from "../api";
import type { SoundController } from "./useSoundController";
import { soundCopy } from "./copy";
import EqualizerBands from "./EqualizerBands";
import SoundPresetSection from "./SoundPresetSection";
import PersonalCurveBands from "./PersonalCurveBands";
import PersonalProfiles from "./PersonalProfiles";
import PersonalWizard from "./PersonalWizard";
import type { SoundState, PersonalProfile } from "./types";
export default function SoundControls({
  controller,
  language,
  canResume,
}: {
  controller: SoundController & { state: SoundState };
  language: string;
  canResume: boolean;
}) {
  const { state, draft, edit, flush, refresh, action, pending, error } =
      controller,
    t = soundCopy(language),
    [setup, setSetup] = useState(false),
    [deviceError, setDeviceError] = useState("");
  const [replacement, setReplacement] = useState<PersonalProfile>();
  const activeProfile =
    draft.personalEnabled && state.personalAvailable
      ? draft.profiles.find((p) => p.id === draft.profileId)
      : undefined;
  const wasSetup = useRef(false);
  useEffect(() => {
    if (wasSetup.current && !setup)
      document
        .querySelector<HTMLElement>(".personal-profiles h3")
        ?.focus({ preventScroll: true });
    wasSetup.current = setup;
  }, [setup]);
  const effectsEnabled = draft.enabled || !!activeProfile;
  const status =
    state.status === "ready"
      ? t.ready
      : state.status === "active"
        ? state.bypass
          ? t.bypass
          : !effectsEnabled
            ? t.off
            : t.active
        : state.status === "activation"
          ? t.activation
          : state.status === "output-unavailable"
            ? t.unavailable
            : t.failed;
  return (
    <div className="sound-controls">
      {setup ? (
        <PersonalWizard
          language={language}
          replacement={replacement}
          routeMonitoring={state.routeMonitoring}
          onDone={() => {
            setSetup(false);
            void refresh();
          }}
        />
      ) : (
        <>
          <p className="sound-status" role="status">
            {status}
            {state.status === "ready" && !effectsEnabled ? ` · ${t.off}` : ""}
          </p>
          {(error || state.reason || deviceError) && (
            <p className="sound-error" role="alert">
              {error || state.reason || deviceError}
            </p>
          )}
          {state.migrationNotice && <p>{state.migrationNotice}</p>}
          {["activation", "output-unavailable", "failed"].includes(
            state.status,
          ) && (
            <button
              className="button secondary"
              onClick={() => void action({ op: "retry" })}
            >
              {t.retry}
            </button>
          )}
          <section aria-label={t.equalizer}>
            <div className="sound-heading">
              <h3>{t.equalizer}</h3>
              {!activeProfile && (
                <label className="check-label">
                  <input
                    type="checkbox"
                    disabled={!!activeProfile || controller.acting}
                    checked={draft.enabled}
                    onChange={(e) => {
                      const enabled = e.target.checked;
                      edit((c) => ({ ...c, enabled }));
                    }}
                  />
                  {t.on}
                </label>
              )}
            </div>
            <SoundPresetSection
              config={draft}
              edit={edit}
              language={language}
              profile={activeProfile}
              busy={controller.acting}
            />
            <fieldset className="sound-fieldset" disabled={controller.acting}>
              {activeProfile ? (
                <PersonalCurveBands
                  left={activeProfile.left}
                  right={activeProfile.right}
                  strength={draft.strength}
                  config={draft}
                  edit={edit}
                  flush={flush}
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
            <div className="sound-actions">
              {!activeProfile && (
                <button
                  className="text-button"
                  disabled={controller.acting}
                  onClick={() =>
                    edit((c) => ({
                      ...c,
                      gains: Array(10).fill(0),
                      presetId: "flat",
                    }))
                  }
                >
                  {t.flat}
                </button>
              )}
              <button
                className="text-button"
                aria-pressed={state.bypass}
                disabled={controller.acting}
                onClick={() =>
                  void action({ op: "bypass", value: !state.bypass })
                }
              >
                {t.bypass}
              </button>
            </div>
            <p className="sound-save-state" role="status">
              {pending ? t.saving : error ? "" : t.saved}
            </p>
          </section>
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
            onSetup={(profile) => {
              setReplacement(profile);
              flush();
              setSetup(true);
            }}
          />
          {canResume && (
            <button
              className="button secondary"
              onClick={() =>
                void api.toggle().catch((e) => setDeviceError(String(e)))
              }
            >
              {t.resume}
            </button>
          )}
          {state.systemPanel && (
            <>
              <button
                className="button secondary"
                onClick={() =>
                  void api
                    .openSoundPanel()
                    .then(() => refresh())
                    .catch((e) => setDeviceError(String(e)))
                }
              >
                {t.device}
              </button>
              <p className="operation-note">{t.deviceHint}</p>
            </>
          )}
        </>
      )}
    </div>
  );
}
