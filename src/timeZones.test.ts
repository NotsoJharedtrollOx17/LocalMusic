import { expect, it } from "vitest";
import { describeTimeZone, currentZoneTime } from "./timeZones";

it("shows readable Pacific/Eastern labels with both daylight offsets", () => {
  const pacific = describeTimeZone("America/Los_Angeles", "en", 2026);
  expect(pacific.label).toContain("Los Angeles — PST/PDT");
  expect(pacific.label).toContain("UTC-08:00 / UTC-07:00");
  expect(pacific.label).not.toMatch(/_|America\//);
  expect(describeTimeZone("America/New_York", "es", 2026).label).toContain(
    "New York — EST/EDT · UTC-05:00 / UTC-04:00",
  );
  expect(
    currentZoneTime(
      "America/Los_Angeles",
      "en",
      new Date("2026-01-15T20:00:00Z"),
    ),
  ).toContain("PST (UTC-08:00)");
  expect(
    currentZoneTime(
      "America/Los_Angeles",
      "en",
      new Date("2026-07-15T20:00:00Z"),
    ),
  ).toContain("PDT (UTC-07:00)");
});
it("preserves fractional offsets, fixed zones and multi-part location names", () => {
  expect(describeTimeZone("Asia/Kathmandu", "en", 2026).label).toContain(
    "UTC+05:45",
  );
  expect(describeTimeZone("UTC", "en", 2026).label).toContain("UTC+00:00");
  expect(
    describeTimeZone("America/Argentina/Buenos_Aires", "en", 2026).label,
  ).toContain("Argentina / Buenos Aires");
});
