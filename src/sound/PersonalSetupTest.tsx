import { soundCopy } from "./copy";
import type { PersonalSession } from "./types";
import PersonalResponseChart from "./PersonalResponseChart";
export default function PersonalSetupTest({
  language,
  session,
  pending,
  queued,
  answerQueued,
  onAnswer,
  onStop,
}: {
  language: string;
  session: PersonalSession;
  pending: boolean;
  queued: boolean;
  answerQueued: boolean;
  onAnswer: (heard: boolean) => void;
  onStop: () => void;
}) {
  const t = soundCopy(language);
  const answerable = session.awaiting && !pending && !queued;
  const completed = session.answeredTrials;
  const percent = Math.round((completed / session.totalTrials) * 100);
  const prompt = answerQueued
    ? t.answerRecorded
    : queued || pending
      ? t.preparingTone
      : t.hearQuestion;
  return (
    <>
      <div className="setup-stage-label">
        <span>{session.ear === 0 ? t.left : t.right}</span>
        <span>
          {t.progress} {Math.min(completed + 1, session.totalTrials)}/
          {session.totalTrials}
        </span>
      </div>
      <PersonalResponseChart language={language} session={session} />
      <div className="setup-question">
        <h3 tabIndex={-1} aria-live="polite">
          {prompt}
        </h3>
        <progress
          aria-label={t.setupProgress}
          max={session.totalTrials}
          value={completed}
        />
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
          <button className="text-button" onClick={onStop}>
            {t.stop}
          </button>
        </div>
      </div>
    </>
  );
}
