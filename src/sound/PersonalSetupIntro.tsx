import { Headphones, Volume2, Waves } from "lucide-react";
import { soundCopy } from "./copy";
export default function PersonalSetupIntro({
  language,
  confirmed,
  setConfirmed,
  pending,
  onBegin,
  onCancel,
  routeMonitoring,
}: {
  language: string;
  confirmed: boolean;
  setConfirmed: (value: boolean) => void;
  pending: boolean;
  onBegin: () => void;
  onCancel: () => void;
  routeMonitoring: boolean;
}) {
  const t = soundCopy(language);
  return (
    <>
      <div className="setup-introduction">
        <Headphones size={40} aria-hidden="true" />
        <h3 tabIndex={-1}>{t.setupLead}</h3>
        <p>{t.setupSummary}</p>
      </div>
      <ol className="setup-preparation">
        {[
          { Icon: Headphones, text: t.prepareHeadphones },
          { Icon: Waves, text: t.prepareQuiet },
          { Icon: Volume2, text: t.prepareVolume },
        ].map(({ Icon, text }) => (
          <li key={text}>
            <Icon size={22} aria-hidden="true" />
            <span>{text}</span>
          </li>
        ))}
      </ol>
      <p className="operation-note">{t.setupPause}</p>
      {!routeMonitoring && <p className="operation-note">{t.monitoring}</p>}
      <label className="check-label">
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(e) => setConfirmed(e.target.checked)}
        />
        {t.headphones}
      </label>
      <div className="setup-footer">
        <button
          className="button primary"
          disabled={!confirmed || pending}
          onClick={onBegin}
        >
          {t.begin}
        </button>
        <button className="text-button" onClick={onCancel}>
          {t.cancel}
        </button>
      </div>
    </>
  );
}
