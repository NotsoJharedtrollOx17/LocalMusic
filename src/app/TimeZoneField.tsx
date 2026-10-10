import { useEffect, useMemo, useState } from "react";
import { describeTimeZone, currentZoneTime } from "../timeZones";
import { en, es } from "../i18n";

export default function TimeZoneField({
  value,
  language,
  onChange,
}: {
  value: string;
  language: "en" | "es";
  onChange: (zone: string) => void;
}) {
  const t = language === "es" ? es : en;
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60000);
    return () => window.clearInterval(timer);
  }, []);
  const year = now.getUTCFullYear();
  const catalog = useMemo(
    () =>
      [
        ...new Set([
          "UTC",
          ...(typeof Intl.supportedValuesOf === "function"
            ? Intl.supportedValuesOf("timeZone")
            : ["America/Los_Angeles", "America/New_York", "Europe/Madrid"]),
        ]),
      ].map((zone) => ({ zone, ...describeTimeZone(zone, language, year) })),
    [language, year],
  );
  const selected = catalog.find((option) => option.zone === value) ?? {
    zone: value,
    ...describeTimeZone(value, language, year),
  };
  const options = [
    selected,
    ...catalog.filter((option) => option.zone !== value),
  ];
  return (
    <label>
      {t.timeZone}
      <select
        aria-label={t.timeZone}
        aria-describedby="time-zone-detail time-zone-current time-zone-hint"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={option.zone} value={option.zone}>
            {option.label}
          </option>
        ))}
      </select>
      <span id="time-zone-detail" className="time-zone-note">
        {selected.detail}
      </span>
      <span id="time-zone-current" className="time-zone-note">
        {t.localTime}: {currentZoneTime(value, language, now)}
      </span>
      <span id="time-zone-hint" className="time-zone-note">
        {t.timeZoneHint}
      </span>
    </label>
  );
}
