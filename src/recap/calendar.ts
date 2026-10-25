const formatters = new Map<string, Intl.DateTimeFormat>();
export function localDate(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  return ["year", "month", "day"]
    .map((k) =>
      parts
        .find((p) => p.type === k)!
        .value.padStart(k === "year" ? 4 : 2, "0"),
    )
    .join("-");
}
export function calendarDate(value: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value))
    throw new Error("Invalid calendar date");
  const d = new Date(value + "T00:00:00Z");
  if (
    !Number.isFinite(+d) ||
    d.toISOString().slice(0, 10) !== value ||
    +value.slice(0, 4) < 1 ||
    +value.slice(0, 4) > 9999
  )
    throw new Error("Invalid calendar date");
  return d;
}
export function addDays(value: string, days: number): string {
  const d = calendarDate(value);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
function wallTime(t: number, timeZone: string): number {
  let f = formatters.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    });
    formatters.set(timeZone, f);
  }
  const p = f.formatToParts(new Date(t)),
    v = (k: string) => p.find((x) => x.type === k)!.value;
  return +new Date(
    `${v("year").padStart(4, "0")}-${v("month")}-${v("day")}T${v("hour")}:${v("minute")}:${v("second")}Z`,
  );
}
const midnightCache = new Map<string, number>();
/** Earliest occurrence, or first valid local minute after a midnight gap. */
export function localMidnight(
  year: number,
  month: number,
  day: number,
  zone: string,
): number {
  const normalized = new Date("2000-01-01T00:00:00Z");
  normalized.setUTCFullYear(year, month, day);
  const target = +normalized,
    key = zone + "|" + target,
    cached = midnightCache.get(key);
  if (cached !== undefined) return cached;
  const offsets = new Set<number>();
  for (let h = -48; h <= 48; h += 6) {
    const t = target + h * 3600000;
    offsets.add(wallTime(t, zone) - t);
  }
  for (let minute = 0; minute <= 2880; minute++) {
    const desired = target + minute * 60000;
    const candidates = [...offsets]
      .map((o) => desired - o)
      .filter((t) => wallTime(t, zone) === desired);
    if (candidates.length) {
      const result = Math.min(...candidates);
      if (midnightCache.size > 4096) midnightCache.clear();
      midnightCache.set(key, result);
      return result;
    }
  }
  throw new Error("Could not resolve calendar boundary");
}
export function dateBoundary(date: string, zone: string): number {
  const d = calendarDate(date);
  return localMidnight(
    d.getUTCFullYear(),
    d.getUTCMonth(),
    d.getUTCDate(),
    zone,
  );
}
