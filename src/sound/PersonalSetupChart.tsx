import { soundCopy } from "./copy";
import PersonalSetupChannel from "./PersonalSetupChannel";
export default function PersonalSetupChart({
  left = [],
  right = [],
  ear,
  language,
  provisional = false,
}: {
  left?: number[];
  right?: number[];
  ear?: number;
  language: string;
  provisional?: boolean;
}) {
  const t = soundCopy(language);
  return (
    <div className="setup-chart">
      <div className="setup-stereo-chart">
        <PersonalSetupChannel
          curve={left}
          label={t.leftChannel}
          active={ear === 0}
        />
        <PersonalSetupChannel
          curve={right}
          label={t.rightChannel}
          active={ear === 1}
        />
      </div>
      <p className="setup-chart-caption">
        {provisional ? t.setupCurve : t.resultCurve}
      </p>
    </div>
  );
}
