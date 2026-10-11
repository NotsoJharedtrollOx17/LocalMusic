import PersonalCurveBand from "./PersonalCurveBand";
import { FREQUENCIES } from "./types";
export default function PersonalCurveBank({
  curve,
  channel,
  inactive,
  language,
}: {
  curve: number[];
  channel: string;
  inactive: number[];
  language: string;
}) {
  return (
    <div className="personal-curve-bank" role="group" aria-label={channel}>
      <h4>{channel}</h4>
      <div className="personal-bank-faders">
        {FREQUENCIES.map((frequency, i) => (
          <PersonalCurveBand
            key={frequency}
            frequency={frequency}
            gain={curve[i]}
            channel={channel}
            inactive={inactive.includes(i)}
            language={language}
          />
        ))}
      </div>
    </div>
  );
}
