import { useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { api, native } from "../api";
import { applyTheme } from "../theme";
import { desktop, onDesktop, type Change } from "./windows";
import type { Settings } from "../types";
import { settingsDelta } from "./settings";
export function useSyncedSettings(
  settings: Settings | undefined,
  setSettings: React.Dispatch<React.SetStateAction<Settings | undefined>>,
  act: (fn: () => Promise<unknown>) => Promise<unknown>,
) {
  const baseline = useRef(settings),
    latest = useRef(settings),
    writes = useRef(Promise.resolve());
  latest.current = settings;
  useEffect(() => {
    if (!settings) return;
    document.documentElement.lang = settings.language;
    applyTheme(settings.theme);
    if (native && /Windows/i.test(navigator.userAgent)) {
      const dark =
        settings.theme === "dark" ||
        (settings.theme === "system" &&
          matchMedia("(prefers-color-scheme: dark)").matches);
      void desktop.action({ op: "appearance", dark }).catch(() => {});
    }
    const previous = baseline.current;
    baseline.current = settings;
    if (!previous) return;
    const patch = settingsDelta(previous, settings);
    if (!Object.keys(patch).length) return;
    writes.current = writes.current
      .catch(() => {})
      .then(async () => {
        if (native) await invoke("patch_settings", { patch });
        else await api.saveSettings(settings);
      });
    void act(() => writes.current);
  }, [settings, act]);
  useEffect(() => {
    if (!native) return;
    let disposed = false,
      off: (() => void) | undefined,
      revision = 0,
      request = 0;
    const refresh = async () => {
      const token = ++request;
      const next = await api.settings();
      if (disposed || token !== request) return;
      // Retain local edits that have not reached the effect yet.
      const dirty =
        baseline.current && latest.current
          ? settingsDelta(baseline.current, latest.current)
          : {};
      baseline.current = next;
      setSettings({ ...next, ...dirty });
    };
    void onDesktop<Change>("changed", (event) => {
      if (
        (event.domain !== "settings" && event.domain !== "privacy") ||
        event.revision <= revision
      )
        return;
      revision = event.revision;
      void writes.current
        .catch(() => {})
        .then(refresh)
        .catch(() => {});
    }).then((unlisten) => {
      if (disposed) unlisten();
      else {
        off = unlisten;
        void refresh().catch(() => {});
      }
    });
    const focus = () =>
      void writes.current
        .catch(() => {})
        .then(refresh)
        .catch(() => {});
    window.addEventListener("focus", focus);
    return () => {
      disposed = true;
      off?.();
      window.removeEventListener("focus", focus);
    };
  }, [setSettings]);
  return writes;
}
