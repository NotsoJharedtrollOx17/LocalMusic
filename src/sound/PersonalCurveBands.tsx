import { useState } from "react";
import EqualizerBands from "./EqualizerBands";
import { defaultSound } from "./model";
import { soundCopy } from "./copy";
export default function PersonalCurveBands({
  left,
  right,
  strength,
  language,
  ear,
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
  ear?: number;
  config?: import("./types").SoundConfig;
  edit?: (
    f: (c: import("./types").SoundConfig) => import("./types").SoundConfig,
  ) => void;
  flush?: () => void;
  inactive?: number[];
  provisional?: boolean;
}) {
  const [selected, setSelected] = useState(0);
  const active = ear ?? selected;
  const t = soundCopy(language);
  const gains = (active === 0 ? left : right).map((g) => (g * strength) / 100);
  return (
    <div className="personal-curve-bands">
      <p>{provisional ? t.provisional : t.curveHint}</p>
      {ear === undefined && (
        <div className="sound-actions">
          {[t.left, t.right].map((label, i) => (
            <button
              key={label}
              className="text-button"
              aria-pressed={selected === i}
              onClick={() => setSelected(i)}
            >
              {label}
            </button>
          ))}
        </div>
      )}
      <EqualizerBands
        config={{ ...(config ?? defaultSound()), gains }}
        edit={edit ?? (() => {})}
        flush={flush ?? (() => {})}
        inactive={inactive}
        language={language}
        readOnly
        showPreamp={!!config}
      />
      {!provisional && gains.every((g) => g === 0) && (
        <p role="status">{t.flatProfile}</p>
      )}
    </div>
  );
}
