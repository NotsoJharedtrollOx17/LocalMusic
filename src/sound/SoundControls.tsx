import "./sound.css";
import { useState } from "react";
import { api } from "../api";
import type { SoundController } from "./useSoundController";
import { soundCopy } from "./copy";
import EqualizerPanel from "./EqualizerPanel";
import AdaptSoundPanel from "./AdaptSoundPanel";
import type { SoundState } from "./types";
export default function SoundControls({
  controller,
  language,
  view,
}: {
  controller: SoundController & { state: SoundState };
  language: string;
  view: "equalizer" | "adapt";
}) {
  const { state, refresh, action, pending, error } = controller;
  const t = soundCopy(language);
  const [deviceError, setDeviceError] = useState("");
  const status =
    state.status === "ready"
      ? t.ready
      : state.status === "active"
        ? t.active
        : state.status === "activation"
          ? t.activation
          : state.status === "output-unavailable"
            ? t.unavailable
            : t.failed;
  return (
    <div className="sound-controls">
      <p
        className={`sound-status${["ready", "active"].includes(state.status) ? " sound-sr-only" : ""}`}
        role="status"
      >
        {status}
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
      {view === "equalizer" ? (
        <EqualizerPanel controller={controller} language={language} />
      ) : (
        <AdaptSoundPanel controller={controller} language={language} />
      )}
      {pending && (
        <p className="sound-save-state" role="status">
          {t.saving}
        </p>
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
    </div>
  );
}
