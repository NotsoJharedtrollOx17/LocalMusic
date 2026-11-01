import { useCallback, useEffect, useState } from "react";
import { flushSync } from "react-dom";
import { invoke } from "@tauri-apps/api/core";
import { getVersion } from "@tauri-apps/api/app";
import { useSyncedSettings } from "./useSyncedSettings";
import { useBackLayer } from "../navigation";
import AboutContent from "../app/AboutContent";
import type { Settings } from "../types";

export default function AboutWindow({
  initialSettings,
}: {
  initialSettings?: Settings;
}) {
  const [settings, setSettings] = useState(initialSettings),
    [version, setVersion] = useState(""),
    [error, setError] = useState("");
  const act = useCallback(async (action: () => Promise<unknown>) => {
    try {
      return await action();
    } catch (e) {
      setError(String(e));
    }
  }, []);
  useSyncedSettings(settings, setSettings, act);
  const close = () => {
    void act(() => invoke("desktop_about", { op: "close", dark: false }));
  };
  useBackLayer(true, close);
  useEffect(() => {
    let disposed = false;
    void act(async () => {
      const current = await getVersion();
      if (disposed) return;
      flushSync(() => setVersion(current));
      const theme = document.documentElement.dataset.theme;
      const dark =
        theme === "dark" ||
        (theme === "system" &&
          matchMedia("(prefers-color-scheme: dark)").matches);
      await invoke("desktop_about", { op: "ready", dark });
    });
    return () => {
      disposed = true;
    };
  }, [act]);
  const es = settings?.language === "es";
  return (
    <main
      className="about-window"
      aria-label={es ? "Acerca de Local Music" : "About Local Music"}
    >
      <h1>{es ? "Acerca de Local Music" : "About Local Music"}</h1>
      <AboutContent version={version} spanish={es} />
      {error && <p role="alert">{error}</p>}
      <button className="button secondary" onClick={close}>
        {es ? "Cerrar" : "Close"}
      </button>
    </main>
  );
}
