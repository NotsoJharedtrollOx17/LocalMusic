import type { CSSProperties } from "react";
import { EQ_BANDS } from "./types";
import { formatGain } from "./formatGain";

export default function PersonalSetupChannel({
  curve,
  label,
  active,
}: {
  curve: number[];
  label: string;
  active: boolean;
}) {
  return (
    <section
      className={`setup-channel${active ? " is-current" : ""}`}
      aria-label={label}
    >
      <p className="setup-channel-title">{label}</p>
      <div className="setup-channel-bars">
        {EQ_BANDS.map(({ frequency, index }) => {
          const gain = curve[index] ?? 0;
          return (
            <div
              key={frequency}
              className="setup-gain"
              data-frequency={frequency}
              data-gain={gain}
              style={
                {
                  "--gain-height": `${Math.min(100, 34 + gain * 10)}%`,
                } as CSSProperties
              }
            >
              <span aria-hidden="true" />
              <span className="sound-sr-only">
                {frequency} Hz: {formatGain(gain)}
              </span>
            </div>
          );
        })}
      </div>
      <div className="setup-channel-axis" aria-hidden="true">
        <span>63 Hz</span>
        <span>16 kHz</span>
      </div>
    </section>
  );
}
