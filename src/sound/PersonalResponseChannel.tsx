import type { CSSProperties } from "react";
import type { ResponseEstimate } from "./types";
import { soundCopy } from "./copy";

export default function PersonalResponseChannel({
  estimates,
  language,
  ear,
  active,
  frequency,
}: {
  estimates: ResponseEstimate[];
  language: string;
  ear: number;
  active: boolean;
  frequency: number;
}) {
  const t = soundCopy(language),
    label = ear === 0 ? t.leftChannel : t.rightChannel;
  return (
    <section
      className={`setup-channel${active ? " is-current" : ""}`}
      aria-label={label}
    >
      <p className="setup-channel-title">{label}</p>
      <div className="setup-channel-bars is-response">
        {[...estimates]
          .sort((a, b) => a.frequency - b.frequency)
          .map((e) => {
            const height =
              e.status === "below-floor"
                ? 100
                : e.estimateDbfs == null
                  ? 8
                  : 16 + ((-36 - e.estimateDbfs) / 36) * 84;
            const status = t.responseStatuses[e.status];
            return (
              <div key={e.frequency} className="setup-response-band">
                <div
                  className={`setup-gain response-${e.status}`}
                  data-frequency={e.frequency}
                  data-estimate={e.estimateDbfs ?? ""}
                  data-status={e.status}
                  data-active={active && frequency === e.frequency}
                  style={{ "--gain-height": `${height}%` } as CSSProperties}
                >
                  <span aria-hidden="true" />
                  <span className="sound-sr-only">
                    {e.frequency} Hz: {status}
                    {e.estimateDbfs == null ? "" : `, ${e.estimateDbfs} dBFS`}
                  </span>
                </div>
                <span className="setup-response-frequency" aria-hidden="true">
                  {e.frequency < 1000 ? e.frequency : `${e.frequency / 1000}k`}
                </span>
              </div>
            );
          })}
      </div>
    </section>
  );
}
