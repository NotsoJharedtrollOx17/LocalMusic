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
  onContinue,
}: {
  language: string;
  session: PersonalSession;
  pending: boolean;
  queued: boolean;
  answerQueued: boolean;
  onAnswer: (heard: boolean) => void;
  onStop: () => void;
  onContinue: () => void;
}) {
  const t = soundCopy(language);
  const answerable = session.awaiting && !pending && !queued;
  const completed = session.answeredTrials;
  const percent = Math.round((completed / session.totalTrials) * 100);
  const paused = session.phase === "paused";
  const prompt = paused
    ? t.setupPaused
    : answerQueued
      ? t.answerRecorded
      : queued || pending
        ? t.preparingTone
        : t.hearQuestion;
  return (
    <>
      <div className="setup-stage-label">
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
      <div className="setup-footer">
        <div className="setup-answers">
          {paused ? (
            <button
              className="button primary setup-continue"
              disabled={pending}
              onClick={onContinue}
            >
              {t.continueSetup}
            </button>
          ) : (
            <>
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
            </>
          )}
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
