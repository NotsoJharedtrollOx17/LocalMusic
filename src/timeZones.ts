const name = (formatter: Intl.DateTimeFormat, date: Date) =>
  formatter.formatToParts(date).find((part) => part.type === "timeZoneName")
    ?.value ?? "";
const offset = (value: string) =>
  value
    .replace(/^GMT/, "UTC")
    .replace(/\u2212/g, "-")
    .replace(/^UTC$/, "UTC+00:00")
    .replace(
      /^UTC([+-])(\d{1,2})(?::(\d{2}))?$/,
      (_, sign, hours, minutes) =>
        `UTC${sign}${hours.padStart(2, "0")}:${minutes ?? "00"}`,
    );

/** Labels are display-only; persistence and recap boundaries keep the IANA ID. */
export function describeTimeZone(zone: string, language: string, year: number) {
  const short = new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    timeZoneName: "short",
  });
  const utc = new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    timeZoneName: "shortOffset",
  });
  const generic = new Intl.DateTimeFormat(language, {
    timeZone: zone,
    timeZoneName: "longGeneric",
  });
  const samples = Array.from(
    { length: 12 },
    (_, month) => new Date(Date.UTC(year, month, 15, 12)),
  );
  const abbreviations = [
    ...new Set(samples.map((date) => name(short, date))),
  ].join("/");
  const offsets = [
    ...new Set(samples.map((date) => offset(name(utc, date)))),
  ].join(" / ");
  const location =
    zone.replace(/_/g, " ").split("/").slice(1).join(" / ") || zone;
  return {
    label: `${location} — ${abbreviations} · ${offsets}`,
    detail: `${name(generic, samples[0])} · ${abbreviations} · ${offsets}`,
  };
}

export function currentZoneTime(zone: string, language: string, now: Date) {
  const local = new Intl.DateTimeFormat(language, {
    timeZone: zone,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(now);
  const abbreviation = name(
    new Intl.DateTimeFormat("en-US", { timeZone: zone, timeZoneName: "short" }),
    now,
  );
  const utc = offset(
    name(
      new Intl.DateTimeFormat("en-US", {
        timeZone: zone,
        timeZoneName: "shortOffset",
      }),
      now,
    ),
  );
  return `${local} · ${abbreviation} (${utc})`;
}
