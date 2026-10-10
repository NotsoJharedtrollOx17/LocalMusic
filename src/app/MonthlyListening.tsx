import { localMidnight } from "../domain";
import { type Recap } from "../types";
import { useMusicAppContext } from "./MusicAppContext";

export default function MonthlyListening() {
  const { settings, recap, t } = useMusicAppContext();
  const monthObserved = (r: Recap, i: number) =>
    Date.parse(r.coveredFrom) < localMidnight(r.year, i + 1, 1, r.timeZone) &&
    Date.parse(r.coveredThrough) >= localMidnight(r.year, i, 1, r.timeZone);
  return (
    recap && (
      <div
        className="month-chart"
        role="img"
        aria-label={recap.months
          .map(
            (ms, i) =>
              new Intl.DateTimeFormat(settings?.language, {
                month: "long",
                timeZone: "UTC",
              }).format(new Date(Date.UTC(2000, i, 1))) +
              ": " +
              (monthObserved(recap, i)
                ? Math.round(ms / 60000) + " " + t.minutes
                : t.unobserved),
          )
          .join("; ")}
      >
        {recap.months.map((ms, i) => {
          const observed = monthObserved(recap, i);
          return (
            <div
              key={i}
              className={observed ? "" : "unobserved"}
              title={
                observed
                  ? Math.round(ms / 60000) + " " + t.minutes
                  : t.unobserved
              }
            >
              <div className="bar-wrap">
                <span
                  style={{
                    height:
                      (ms
                        ? Math.max(3, (ms / Math.max(...recap.months, 1)) * 100)
                        : 0) + "%",
                  }}
                />
              </div>
              <small>
                {new Intl.DateTimeFormat(settings?.language, {
                  month: "short",
                  timeZone: "UTC",
                }).format(new Date(Date.UTC(2000, i, 1)))}
              </small>
            </div>
          );
        })}
      </div>
    )
  );
}
