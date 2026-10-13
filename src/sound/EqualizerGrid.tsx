import type { ReactNode } from "react";

/** One shared level scale keeps every channel bank spatially aligned. */
export default function EqualizerGrid({ children }: { children: ReactNode }) {
  return (
    <div className="equalizer-grid">
      <div className="equalizer-levels" aria-hidden="true">
        {Array.from({ length: 11 }, (_, i) => (
          <div
            className={`equalizer-level${i === 5 ? " zero" : ""}`}
            key={i}
            style={{ top: `calc(${i * 10}% + ${8 - i * 1.6}px)` }}
          >
            {[0, 5, 10].includes(i) && (
              <span>{i === 0 ? "+10 dB" : i === 5 ? "0 dB" : "−10 dB"}</span>
            )}
          </div>
        ))}
      </div>
      <div className="equalizer-faders">{children}</div>
    </div>
  );
}
