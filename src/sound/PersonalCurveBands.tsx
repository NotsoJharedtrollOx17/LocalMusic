import PersonalCurveBand from "./PersonalCurveBand";
import SoundPreamp from "./SoundPreamp";
import { FREQUENCIES } from "./types";
import { soundCopy } from "./copy";
export default function PersonalCurveBands({
  left,
  right,
  strength,
  language,
  config,
  edit,
  flush,
  inactive = [],
  provisional = false,
}: {
  left: number[];
  right: number[];
  strength: number;
  language: string;
  config?: import("./types").SoundConfig;
  edit?: (
    f: (c: import("./types").SoundConfig) => import("./types").SoundConfig,
  ) => void;
  flush?: () => void;
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
      <div className={`personal-stereo-bands${config ? " has-preamp" : ""}`}>
        {FREQUENCIES.map((frequency, i) => (
          <PersonalCurveBand
            key={frequency}
            frequency={frequency}
            left={curves[0][i]}
            right={curves[1][i]}
            inactive={inactive.includes(i)}
            language={language}
          />
        ))}
        {config && edit && flush && (
          <SoundPreamp
            config={config}
            edit={edit}
            flush={flush}
            language={language}
          />
        )}
      </div>
      {!provisional && curves.every((curve) => curve.every((g) => g === 0)) && (
        <p role="status">{t.flatProfile}</p>
      )}
    </div>
  );
}
