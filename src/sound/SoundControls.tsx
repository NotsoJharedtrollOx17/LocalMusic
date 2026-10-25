import "./sound.css";
import type { SoundController } from "./useSoundController";
import { soundCopy } from "./copy";
import EqualizerPanel from "./EqualizerPanel";
import type { SoundState } from "./types";
export default function SoundControls({
  controller,
  language,
}: {
  controller: SoundController & { state: SoundState };
  language: string;
}) {
  const { state, action, error } = controller;
  const t = soundCopy(language);
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
      {(error || state.reason) && (
        <p className="sound-error" role="alert">
          {error || state.reason}
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
      <EqualizerPanel controller={controller} language={language} />
    </div>
  );
}
