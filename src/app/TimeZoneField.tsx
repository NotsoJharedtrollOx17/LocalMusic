import { useEffect, useState } from "react";
import { currentZoneTime } from "../timeZones";
import { en, es } from "../i18n";

/** Read-only device calendar; no manual zone override. */
export default function TimeZoneField({
  value,
  language,
}: {
  value: string;
  language: "en" | "es";
}) {
  const t = language === "es" ? es : en;
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60000);
    return () => window.clearInterval(timer);
  }, []);
  return (
    <div className="device-time-zone">
      <span>{t.timeZone}</span>
      <strong>{t.followsDevice}</strong>
      <span id="time-zone-current" className="time-zone-note">
        {currentZoneTime(value, language, now)}
      </span>
    </div>
  );
}
