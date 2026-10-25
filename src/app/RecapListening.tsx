import { bucketLabel } from "../recap/periods";
import { useMusicAppContext } from "./MusicAppContext";
export default function RecapListening() {
  const { settings, recap, t } = useMusicAppContext();
  if (!recap) return null;
  const values = recap.buckets.map((b) => b.listenedMs),
    language = settings?.language ?? "en";
  const label = (i: number) =>
    `${bucketLabel(recap, i, language, true)}: ${recap.buckets[i].observed ? Math.round(values[i] / 60000) + " " + t.minutes : t.unobserved}`;
  return (
    <div
      className="month-chart"
      style={{
        gridTemplateColumns: `repeat(${values.length}, minmax(0, 1fr))`,
      }}
      role="img"
      aria-label={values.map((_, i) => label(i)).join("; ")}
    >
      {recap.buckets.map((b, i) => (
        <div
          key={b.startDate}
          className={b.observed ? "" : "unobserved"}
          title={label(i)}
        >
          <div className="bar-wrap">
            <span
              style={{
                height:
                  (b.listenedMs
                    ? Math.max(3, (b.listenedMs / Math.max(...values, 1)) * 100)
                    : 0) + "%",
              }}
            />
          </div>
          <small>{bucketLabel(recap, i, language) || "\u00a0"}</small>
        </div>
      ))}
    </div>
  );
}
