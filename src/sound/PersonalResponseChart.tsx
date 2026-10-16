import type { PersonalSession } from "./types";
import { soundCopy } from "./copy";
import PersonalResponseChannel from "./PersonalResponseChannel";

export default function PersonalResponseChart({
  session,
  language,
}: {
  session: PersonalSession;
  language: string;
}) {
  const t = soundCopy(language);
  return (
    <div className="setup-chart setup-response-chart">
      <div className="setup-stereo-chart">
        {[0, 1].map((ear) => (
          <PersonalResponseChannel
            key={ear}
            language={language}
            ear={ear}
            estimates={session.estimates.filter((e) => e.ear === ear)}
            active={session.ear === ear}
            frequency={session.frequency}
          />
        ))}
      </div>
      <p className="sound-sr-only">{t.responseCurve}</p>
    </div>
  );
}
