import { describe, it, expect } from "vitest";
import { settingsDelta } from "./settings";
import type { Settings } from "../types";
describe("cross-window preference patches", () => {
  const base: Settings = {
    language: "en",
    theme: "light",
    timeZone: "UTC",
    historyEnabledSince: "2026-10-01",
    privacyRevision: 3,
  };
  it("sends only local editable changes and never privacy fields", () => {
    expect(
      settingsDelta(base, {
        ...base,
        visualizerMode: "xmb",
        privacyRevision: 7,
        historyEnabledSince: "2026-10-02",
      }),
    ).toEqual({ visualizerMode: "xmb" });
    expect(settingsDelta(base, base)).toEqual({});
  });
  it("keeps independent language and visualizer edits separate", () => {
    expect(settingsDelta(base, { ...base, language: "es" })).toEqual({
      language: "es",
    });
    expect(
      settingsDelta(base, { ...base, visualizerMode: "geometry" }),
    ).toEqual({ visualizerMode: "geometry" });
  });
});
