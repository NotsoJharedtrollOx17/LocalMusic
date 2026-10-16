import { soundCopy } from "./copy";
import PersonalSetupChart from "./PersonalSetupChart";
import type { PersonalSession } from "./types";
export default function PersonalSetupResult({
  language,
  session,
  pending,
  mode,
  name,
  setName,
  onPreview,
  onSave,
  onStop,
  onRestart,
}: {
  language: string;
  session: PersonalSession;
  pending: boolean;
  mode?: string;
  name: string;
  setName: (value: string) => void;
  onPreview: (mode: "original" | "personal") => void;
  onSave: () => void;
  onStop: () => void;
  onRestart: () => void;
}) {
  const t = soundCopy(language);
  const flat = [...(session.left ?? []), ...(session.right ?? [])].every(
    (v) => v === 0,
  );
  const limited = session.estimates.some((e) => e.status !== "bracketed");
  return (
    <>
      <div className="setup-result-heading">
        <h3 tabIndex={-1}>{t.compare}</h3>
        <p>{t.comparisonHint}</p>
      </div>
      <PersonalSetupChart
        language={language}
        left={session.left}
        right={session.right}
      />
      {flat && !limited && <p className="operation-note">{t.quietResult}</p>}
      {limited && <p className="operation-note">{t.limitedCoverage}</p>}
      <div className="setup-comparison">
        {(["original", "personal"] as const).map((m) => (
          <button
            key={m}
            className={`button ${mode === m ? "primary" : "secondary"}`}
            aria-pressed={mode === m}
            disabled={pending}
            onClick={() => onPreview(m)}
          >
            {m === "original" ? t.original : t.personalPreview}
          </button>
        ))}
      </div>
      <form
        className="setup-save-form"
        onSubmit={(e) => {
          e.preventDefault();
          onSave();
        }}
      >
        <label>
          {t.name}
          <input
            aria-label={t.name}
            maxLength={60}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <div className="setup-footer">
          <button className="button primary" disabled={pending || !name.trim()}>
            {t.saveProfile}
          </button>
          <button
            type="button"
            className="text-button"
            disabled={pending}
            onClick={onRestart}
          >
            {t.restart}
          </button>
          <button
            type="button"
            className="text-button"
            disabled={pending}
            onClick={onStop}
          >
            {t.stop}
          </button>
        </div>
      </form>
    </>
  );
}
