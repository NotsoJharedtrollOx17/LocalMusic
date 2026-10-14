import { soundCopy } from "./copy";
import type { PersonalSession } from "./types";
import PersonalSetupChart from "./PersonalSetupChart";
export default function PersonalSetupTest({
  language,
  session,
  pending,
  queued,
  answerQueued,
  now,
  onAnswer,
  onReplay,
  onStop,
}: {
  language: string;
  session: PersonalSession;
  pending: boolean;
  queued: boolean;
  answerQueued: boolean;
  now: number;
  onAnswer: (heard: boolean) => void;
  onReplay: () => void;
  onStop: () => void;
}) {
  const t = soundCopy(language);
  const busy = now < session.busyUntil;
  const answerable = session.awaiting && !pending && !queued;
  const completed = session.ear * 7 + session.step;
  const percent = Math.round((completed / 14) * 100);
  const prompt = answerQueued
    ? t.answerRecorded
    : busy
      ? t.listening
      : queued || pending
        ? t.preparingTone
        : session.awaiting
          ? t.hearQuestion
          : t.playTone;
  return (
    <>
      <div className="setup-stage-label">
        <span>{session.ear === 0 ? t.left : t.right}</span>
        <span>
          {t.progress} {completed + 1}/14
        </span>
      </div>
      <PersonalSetupChart
        language={language}
        left={session.left}
        right={session.right}
        ear={session.ear}
        provisional
      />
      <div className="setup-question">
        <h3 tabIndex={-1} aria-live="polite">
          {prompt}
        </h3>
        <progress aria-label={t.setupProgress} max={14} value={completed} />
        <strong aria-hidden="true">{percent}%</strong>
      </div>
      <details className="setup-tone-details">
        <summary>{t.setupDetails}</summary>
        <p>
          {session.frequency < 1000
            ? `${session.frequency} Hz`
            : `${session.frequency / 1000} kHz`}{" "}
          · {session.level} dBFS · {t.burst}
        </p>
      </details>
      <div className="setup-footer">
        <div className="setup-answers">
          <button
            className="button secondary"
            aria-label={t.notHeard}
            disabled={!answerable}
            onClick={() => onAnswer(false)}
          >
            {t.no}
          </button>
          <button
            className="button primary"
            aria-label={t.heard}
            disabled={!answerable}
            onClick={() => onAnswer(true)}
          >
            {t.yes}
          </button>
        </div>
        <div className="setup-secondary-actions">
          <button
            className="text-button"
            disabled={pending || queued || now < session.busyUntil + 500}
            onClick={onReplay}
          >
            {t.playTone}
          </button>
          <button className="text-button" onClick={onStop}>
            {t.stop}
          </button>
        </div>
      </div>
    </>
  );
}
