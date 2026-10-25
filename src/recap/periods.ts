import type {
  Recap,
  RecapKind,
  RecapPeriod,
  RecapRequest,
  Settings,
} from "../types";
import { addDays, calendarDate, dateBoundary, localDate } from "./calendar";
export { addDays, dateBoundary, localDate } from "./calendar";
export function periodFor(request: RecapRequest): RecapPeriod {
  const d = calendarDate(request.anchorDate);
  if (d.getUTCFullYear() > 9998) throw new Error("Invalid recap date");
  const kind = request.kind;
  if (!["week", "month", "year"].includes(kind))
    throw new Error("Invalid recap period");
  if (kind === "week") {
    const startDate = addDays(request.anchorDate, -((d.getUTCDay() + 6) % 7));
    return { kind, startDate, endDate: addDays(startDate, 7) };
  }
  const year = request.anchorDate.slice(0, 4),
    month = request.anchorDate.slice(5, 7);
  const startDate = kind === "year" ? `${year}-01-01` : `${year}-${month}-01`;
  const end = calendarDate(startDate);
  if (kind === "year") end.setUTCFullYear(end.getUTCFullYear() + 1);
  else end.setUTCMonth(end.getUTCMonth() + 1);
  return { kind, startDate, endDate: end.toISOString().slice(0, 10) };
}
export const periodRequest = (p: RecapPeriod): RecapRequest => ({
  kind: p.kind,
  anchorDate: p.startDate,
});
export function bucketDates(p: RecapPeriod): string[] {
  const dates = [p.startDate];
  let d = p.startDate;
  while (d < p.endDate) {
    if (p.kind === "year") {
      const next = calendarDate(d);
      next.setUTCMonth(next.getUTCMonth() + 1);
      d = next.toISOString().slice(0, 10);
    } else d = addDays(d, 1);
    dates.push(d);
  }
  return dates;
}
export function periodOptions(
  kind: RecapKind,
  s: Settings,
  now = new Date(),
): RecapPeriod[] {
  const oldest = periodFor({
    kind,
    anchorDate: localDate(new Date(s.historyEnabledSince), s.timeZone),
  }).startDate;
  let p = periodFor({ kind, anchorDate: localDate(now, s.timeZone) });
  const out: RecapPeriod[] = [];
  while (true) {
    out.push(p);
    if (p.startDate <= oldest) break;
    p = periodFor({ kind, anchorDate: addDays(p.startDate, -1) });
  }
  return out;
}
export function periodLabel(p: RecapPeriod, language = "en"): string {
  const f = (date: string, options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat(language, { ...options, timeZone: "UTC" }).format(
      calendarDate(date),
    );
  if (p.kind === "year") return p.startDate.slice(0, 4);
  if (p.kind === "month")
    return f(p.startDate, { month: "long", year: "numeric" });
  return `${f(p.startDate, { month: "short", day: "numeric", year: "numeric" })} – ${f(addDays(p.endDate, -1), { month: "short", day: "numeric", year: "numeric" })}`;
}
export function bucketLabel(
  r: Recap,
  i: number,
  language = "en",
  full = false,
): string {
  const date = r.buckets[i].startDate,
    day = +date.slice(8);
  if (full)
    return new Intl.DateTimeFormat(language, {
      timeZone: "UTC",
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(calendarDate(date));
  if (r.period.kind === "month")
    return [
      1,
      5,
      10,
      15,
      20,
      25,
      +r.buckets.at(-1)!.startDate.slice(8),
    ].includes(day)
      ? String(day)
      : "";
  return new Intl.DateTimeFormat(language, {
    timeZone: "UTC",
    ...(r.period.kind === "year"
      ? { month: "short" as const }
      : { weekday: "short" as const }),
  }).format(calendarDate(date));
}
/** Compatibility projection only: stored legacy snapshots are never rewritten. */
export function normalizeRecap(input: unknown): Recap {
  const r = input as Recap & {
    year: number;
    months: number[];
    completeYear: boolean;
  };
  if (r.schemaVersion === 2) return r;
  if (
    r.schemaVersion !== 1 ||
    !Number.isInteger(r.year) ||
    !Array.isArray(r.months) ||
    r.months.length !== 12
  )
    throw new Error("Invalid recap snapshot");
  const period = periodFor({
      kind: "year",
      anchorDate: `${String(r.year).padStart(4, "0")}-01-01`,
    }),
    edges = bucketDates(period);
  const { year: _year, months, completeYear, ...rest } = r;
  return {
    ...rest,
    schemaVersion: 2,
    period,
    completePeriod: completeYear,
    buckets: months.map((listenedMs, i) => ({
      startDate: edges[i],
      endDate: edges[i + 1],
      listenedMs,
      observed:
        Date.parse(r.coveredFrom) < dateBoundary(edges[i + 1], r.timeZone) &&
        Date.parse(r.coveredThrough) > dateBoundary(edges[i], r.timeZone),
    })),
  };
}
