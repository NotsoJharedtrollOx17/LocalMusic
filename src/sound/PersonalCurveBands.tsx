import PersonalCurveBank from "./PersonalCurveBank";
import { soundCopy } from "./copy";
export default function PersonalCurveBands({
  left,
  right,
  strength,
  language,
  inactive = [],
  provisional = false,
}: {
  left: number[];
  right: number[];
  strength: number;
  language: string;
  inactive?: number[];
  provisional?: boolean;
}) {
  const t = soundCopy(language);
  const curves = [left, right].map((curve) =>
    curve.map((g) => (g * strength) / 100),
  );
  return (
    <div className="personal-curve-bands">
      <p>{provisional ? t.provisional : t.curveHint}</p>
      <p>{t.readOnlyCurve}</p>
      <div className="personal-stereo-bands">
        <PersonalCurveBank
          curve={curves[0]}
          channel={t.leftChannel}
          inactive={inactive}
          language={language}
        />
        <PersonalCurveBank
          curve={curves[1]}
          channel={t.rightChannel}
          inactive={inactive}
          language={language}
        />
      </div>
      {!provisional && curves.every((curve) => curve.every((g) => g === 0)) && (
        <p role="status">{t.flatProfile}</p>
      )}
    </div>
  );
}
